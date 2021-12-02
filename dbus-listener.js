const dbus = require('dbus-native')
const _ = require('lodash')

module.exports = function (app, messageCallback, address, plugin, pollInterval) {
  return new Promise((resolve, reject) => {
    const setPluginStatus = app.setPluginStatus
        ? (msg) => {
          app.setPluginStatus(msg)
        }
          : () => {}
    const setPluginError = app.setPluginError
        ? (msg) => {
          app.setPluginError(msg)
        }
          : () => {}
    let msg = `Connecting ${address}`
    setPluginStatus(msg)
    app.debug(msg)
    var bus
    if (address) {
      bus = dbus.createClient({
        busAddress: address,
        authMethods: ['ANONYMOUS']
      })
    } else {
      bus = process.env.DBUS_SESSION_BUS_ADDRESS
        ? dbus.sessionBus()
        : dbus.systemBus()
    }

    if (!bus) {
      let msg = 'Could not connect to the D-Bus'
      setPluginError(msg)
      throw new Error(msg)
    }

    // Dict that lists the services on D-Bus that we track.
    // name owner (:0132 for example) is the key. Properties:
    // .name            for example: com.victronenergy.battery.ttyO1
    // .deviceInstace   for example: 0
    var services = {}

    // get info on all existing D-Bus services at startup
    bus.listNames((props, args) => {
      args.forEach(name => {
        if (name.startsWith('com.victronenergy')) {
          bus.getNameOwner(name, (props, args) => {
            initService(args, name)
          })
        }
      })
    })

    function pollDbus () {
      _.values(services).forEach(service => {
        requestRoot(service)
      })
    }

    function initService (owner, name) {
      var service = { name: name }
      services[owner] = service

      app.debug(`${name} is sender ${owner}`)

      bus.invoke(
        {
          path: '/DeviceInstance',
          destination: name,
          interface: 'com.victronenergy.BusItem',
          member: 'GetValue'
        },
        function (err, res) {
          if (err) {
            // There are several dbus services that don't have the /DeviceInstance
            // path. They are services that are not interesting for signalk, like
            // a process to manage settings on the dbus, the logger to VRM Portal
            // and others. All services that send out data for connected devices do
            // have the /DeviceInstance path.
            app.debug(`warning: error getting device instance for ${name}`)
            services[owner].deviceInstance = 99
          } else {
            services[owner].deviceInstance = res[1][0]
          }
        }
      )

      requestRoot(service)
    }

    function requestRoot (service) {
      // app.debug(`getValue / ${service.name}`)
      bus.invoke(
        {
          path: '/',
          destination: service.name,
          interface: 'com.victronenergy.BusItem',
          member: 'GetValue'
        },
        function (err, res) {
          if (err) {
            // Some services don't support requesting the root path. They are not
            // interesting to signalk, see above in the comments on /DeviceInstance
            app.debug(
              `warning: error during GetValue on / for ${service.name} ${err}`
            )
          } else {
            var data = {}
            res[1][0].forEach(kp => {
              data[kp[0]] = kp[1][1][0]
            })

            service.deviceInstance = data.DeviceInstance

            if (!_.isUndefined(data.FluidType)) {
              service.fluidType = data.FluidType
            }

            if (!_.isUndefined(data.TemperatureType)) {
              service.temperatureType = data.TemperatureType
            }

            // app.debug(`${service.name} ${JSON.stringify(data)}`)

            let deviceInstance = service.deviceInstance

            if ( _.isUndefined(deviceInstance) ) {
              return
            }
            
            if ( plugin.options.instanceMappings ) {
              const mapping = plugin.options.instanceMappings.find(mapping => {
                return service.name.startsWith(mapping.type) && mapping.venusId == deviceInstance
              })
              if ( !_.isUndefined(mapping) ) {
                deviceInstance = mapping.signalkId
              }
            }

            var messages = []
            _.keys(data).forEach(path => {
              messages.push({
                path: '/' + path,
                senderName: service.name,
                value: data[path],
                instanceName: deviceInstance,
                fluidType: service.fluidType,
                temperatureType: service.temperatureType
              })
            })
            messageCallback(messages)
          }
        }
      )
    }

    function signal_receive (m) {
      if (
        m.interface === 'com.victronenergy.BusItem' 
        && m.member === 'PropertiesChanged'
      ) {
        properties_changed(m)
      } else if (
        m.interface == 'org.freedesktop.DBus' &&
        m.member == 'NameOwnerChanged'
      ) {
        name_owner_changed(m)
      } else if ( m.body &&
                  m.body.length > 0 &&
                  _.isArray(m.body[0]) &&
                  m.body[0].length > 1 &&
                  _.isArray(m.body[0][1]) &&
                  m.body[0][1].length > 0 &&
                  _.isArray(m.body[0][1][0]) &&
                  m.body[0][1][0].length > 0
                ) {
        properties_changed(m)
      }
    }

    function name_owner_changed (m) {
      name = m.body[0]
      old_owner = m.body[1]
      new_owner = m.body[2]

      app.debug('name owner change: %j', m)

      if (name.startsWith('com.victronenergy') && new_owner && new_owner.length > 0 ) {
        initService(new_owner, name)
      } else {
        delete services[old_owner]
      }
    }

    function properties_changed (m) {
      // Message contents:
      // { serial: 5192,
      //   path: '/Dc/0/Power',
      //   interface: 'com.victronenergy.BusItem',
      //   member: 'PropertiesChanged',
      //   signature: 'a{sv}',
      //   sender: ':1.104',
      //   type: 4,
      //   flags: 1,
      //   body: [ [ [Object], [Object] ] ]}

      const sender = m.sender
      var service = services[sender]

      if (!service || !service.name) {
        // See comment above explaining why some services don't have the
        // /DeviceInstance path
        // app.debug(`warning: unknown service; ${m.sender}`)
        return
      }

      const senderName = service.name
      let instanceName = service.deviceInstance

      if ( plugin.options.instanceMappings ) {
        const mapping = plugin.options.instanceMappings.find(mapping => {
          return service.name.startsWith(mapping.type) && mapping.venusId == m.instanceName
        })
        if ( !_.isUndefined(mapping) ) {
          instanceName = mapping.signalkId
        }
      }      

      let entries

      if ( !m.member ) {
        entries = m.body[0][1][0]
          .filter(item => _.isArray(item) && item.length > 0 )
          .map(item => {
            return { path: '/' + item[0], value: item[1][1][0] }
          })
      } else if ( m.member === 'PropertiesChanged' ) {
        let value, text
        
        m.body[0].forEach(entry => {
          if (entry[0] == 'Text') {
            text = entry[1][1][0]
          } else if (entry[0] == 'Value') {
            value = entry[1][1][0]
          } else if (entry[0] == 'Valid') {
            // Ignoring Valid because it is deprecated
          }
        })
        entries = [ { path: m.path, value, text} ]
      }


      entries.forEach(msg => {
        let instanceName
        if (msg.path == '/DeviceInstance') {
          instanceName = msg.value
          services[sender].instanceName
        } else {
          instanceName = service.deviceInstance
        }

        msg.instanceName = instanceName
        msg.senderName = senderName
      
        messageCallback([msg])
      })
    }

    function setValue (destination, path, value) {
      app.debug(`setValue: ${destination} ${path} = ${value}`)
      bus.invoke(
        {
          path: path,
          destination: destination,
          interface: 'com.victronenergy.BusItem',
          member: 'SetValue',
          body: [
            // top level struct is js array
            ['n', value] // variant, type is number, value = 1
          ],
          signature: 'v'
        },
        function (err, res) {
          if (err) {
            app.error(err)
          }
        }
      )
    }

    bus.connection.on('connect', () => {
      setPluginStatus(`Connected to ${address ? address : 'session bus'}`)
      if ( pollInterval > 0 ) {
        const pollingTimer = setInterval(pollDbus, pollInterval*1000)
        resolve({
          setValue,
          onStop: () => {
            clearInterval(pollingTimer)
          }
        })
      }
    })

    // if resolved within timeout reject has no effect
    setTimeout(() => reject('Timeout waiting for connection'), 10 * 1000)

    bus.connection.on('message', signal_receive)

    bus.connection.on('error', error => {
      setPluginError(error.message)
      app.error(error.message)
      reject(error)
      plugin.onError()
    })

    bus.connection.on('end', () => {
      setPluginError('lost connection to D-Bus')
      app.error(`lost connection to D-Bus`)
      // here we could (should?) also clear the polling timer. But decided not to do that;
      // to be looked at when properly fixing the dbus-connection lost issue.
    })

    bus.addMatch(
      "type='signal',interface='com.victronenergy.BusItem',member='PropertiesChanged'",
      d => {}
    )
    bus.addMatch("type='signal',member='NameOwnerChanged'", d => {})
  })
}
