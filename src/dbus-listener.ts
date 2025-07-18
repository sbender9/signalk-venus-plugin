/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

const dbus = require('dbus-native')
const _ = require('lodash')
const camelcase = require('camelcase')
import { Message } from './venusToDeltas'

export default function (
  app: any,
  messageCallback: any,
  address: string,
  plugin: any,
  pollInterval: number
) {
  return new Promise((resolve, reject) => {
    const setPluginStatus = app.setPluginStatus
      ? (msg: string) => {
          app.setPluginStatus(msg)
        }
      : () => {}
    const setPluginError = app.setPluginError
      ? (msg: string) => {
          app.setPluginError(msg)
        }
      : () => {}
    const msg = `Connecting ${address}`
    setPluginStatus(msg)
    app.debug(msg)
    let bus: any
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
      const msg = 'Could not connect to the D-Bus'
      setPluginError(msg)
      throw new Error(msg)
    }

    // Dict that lists the services on D-Bus that we track.
    // name owner (:0132 for example) is the key. Properties:
    // .name            for example: com.victronenergy.battery.ttyO1
    // .deviceInstace   for example: 0
    const services: { [key: string]: any } = {}

    // get info on all existing D-Bus services at startup
    bus.listNames((_props: any, args: string[]) => {
      args.forEach((name) => {
        if (name.startsWith('com.victronenergy')) {
          bus.getNameOwner(name, (_props: any, args: string) => {
            initService(args, name)
          })
        }
      })
    })

    function pollDbus() {
      _.values(services).forEach((service: any) => {
        requestRoot(service)
      })
    }

    function initService(owner: string, name: string) {
      const service = { name: name }
      services[owner] = service

      app.debug(`${name} is sender ${owner}`)

      // Check if this is a virtual device from Signal K Virtual BMV plugin
      bus.invoke(
        {
          path: '/Mgmt/ProcessName',
          destination: name,
          interface: 'com.victronenergy.BusItem',
          member: 'GetValue'
        },
        function (err: any, res: any) {
          if (!err && res[1][0] === 'signalk-virtual-device') {
            app.debug(`Ignoring virtual device ${name} created by Signal K`)
            delete services[owner]
            return
          }

          // Continue with normal service initialization
          bus.invoke(
            {
              path: '/DeviceInstance',
              destination: name,
              interface: 'com.victronenergy.BusItem',
              member: 'GetValue'
            },
            function (err: any, res: any) {
              if (err) {
                // There are several dbus services that don't have the /DeviceInstance
                // path. They are services that are not interesting for signalk, like
                // a process to manage settings on the dbus, the logger to VRM Portal
                // and others. All services that send out data for connected devices do
                // have the /DeviceInstance path.
                if (services[owner]) {
                  app.debug(
                    `warning: error getting device instance for ${name}`
                  )
                  services[owner].deviceInstance = 99
                }
              } else {
                services[owner].deviceInstance = res[1][0]
              }

              if (
                plugin.options.useDeviceNames !== undefined &&
                plugin.options.useDeviceNames
              ) {
                app.debug('requesting custom name for %s', name)
                bus.invoke(
                  {
                    path: '/CustomName',
                    destination: name,
                    interface: 'com.victronenergy.BusItem',
                    member: 'GetValue'
                  },
                  function (err: any, res: any) {
                    if (!err) {
                      const customName = res[1][0]
                      app.debug('got custom name %s for %s', customName, name)
                      services[owner].customName = camelcase(customName)
                    } else {
                      services[owner].customName = ''
                    }
                    requestRoot(service)
                  }
                )
              } else {
                requestRoot(service)
              }
            }
          )
        }
      )
    }

    function requestRoot(service: any) {
      // app.debug(`getValue / ${service.name}`)
      bus.invoke(
        {
          path: '/',
          destination: service.name,
          interface: 'com.victronenergy.BusItem',
          member: 'GetValue'
        },
        function (err: any, res: any) {
          if (err) {
            // Some services don't support requesting the root path. They are not
            // interesting to signalk, see above in the comments on /DeviceInstance
            app.debug(
              `warning: error during GetValue on / for ${service.name} ${err}`
            )
          } else {
            const data: any = {}

            if (res[0][0].type == 'a') {
              res[1][0].forEach((kp: any) => {
                data[kp[0]] = kp[1][1][0]
              })
            } else {
              //for some reason virtual devices come in this way
              res.forEach((kp: any) => {
                data[kp[0]] = kp[1][1][0]
              })
            }

            service.deviceInstance = data.DeviceInstance

            if (!_.isUndefined(data.FluidType)) {
              service.fluidType = data.FluidType
            }

            if (!_.isUndefined(data.TemperatureType)) {
              service.temperatureType = data.TemperatureType
            }

            // app.debug(`${service.name} ${JSON.stringify(data)}`)

            let deviceInstance: string|undefined = undefined

            /*
            //FIXME: paths that don't require instance??
            if ( _.isUndefined(deviceInstance) ) {
              return
              }
            */

            if (plugin.options.instanceMappings) {
              const mapping = plugin.options.instanceMappings.find(
                (mapping: any) => {
                  return (
                    service.name.startsWith(mapping.type) &&
                    mapping.venusId == service.deviceInstance
                  )
                }
              )
              if (!_.isUndefined(mapping)) {
                deviceInstance = mapping.signalkId
              }
            }

            if (deviceInstance === undefined) {
              if (
                plugin.options.useDeviceNames !== undefined &&
                plugin.options.useDeviceNames &&
                service.customName !== ''
              ) {
                deviceInstance = service.customName
              } else deviceInstance = service.deviceInstance
            }

            _.keys(data).forEach((path: string) => {
              const msg: Message = {
                path: '/' + path,
                senderName: service.name,
                value: data[path],
                instanceName: deviceInstance!,
                fluidType: service.fluidType,
                temperatureType: service.temperatureType
              }
              messageCallback(msg)
            })
          }
        }
      )
    }

    function signal_receive(m: any) {
      if (
        m.interface === 'com.victronenergy.BusItem' &&
        (m.member === 'PropertiesChanged' || m.member === 'ItemsChanged')
      ) {
        properties_changed(m)
      } else if (
        m.interface == 'org.freedesktop.DBus' &&
        m.member == 'NameOwnerChanged'
      ) {
        name_owner_changed(m)
      }
    }

    function name_owner_changed(m: any) {
      const name = m.body[0]
      const old_owner = m.body[1]
      const new_owner = m.body[2]

      app.debug('name owner change: %j', m)

      if (
        name.startsWith('com.victronenergy') &&
        new_owner &&
        new_owner.length > 0
      ) {
        initService(new_owner, name)
      } else {
        delete services[old_owner]
      }
    }

    function setValueAndText(data: any, res: any) {
      data.forEach((entry: any) => {
        if (entry[0] == 'Text') {
          res.text = entry[1][1][0]
        } else if (entry[0] == 'Value') {
          res.value = entry[1][1][0]
        }
      })
      return res
    }

    function properties_changed(m: any) {
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
      const service = services[sender]

      if (!service || !service.name || service.deviceInstance === undefined) {
        // See comment above explaining why some services don't have the
        // /DeviceInstance path
        // app.debug(`warning: unknown service; ${m.sender}`)
        return
      }

      const senderName = service.name
      let instanceName: string | undefined

      if (plugin.options.instanceMappings) {
        const mapping = plugin.options.instanceMappings.find((mapping: any) => {
          return (
            service.name.startsWith(mapping.type) &&
            mapping.venusId == service.deviceInstance
          )
        })
        if (mapping !== undefined) {
          instanceName = mapping.signalkId
        }
      }

      if (instanceName === undefined) {
        if (
          plugin.options.useDeviceNames !== undefined &&
          plugin.options.useDeviceNames &&
          service.customName !== ''
        ) {
          instanceName = service.customName
        } else instanceName = service.deviceInstance
      }

      let entries

      if (m.member === 'ItemsChanged') {
        entries = m.body[0].map((item: any) => {
          return setValueAndText(item[1], { path: item[0] })
        })
      } else if (m.member === 'PropertiesChanged') {
        entries = [setValueAndText(m.body[0], { path: m.path })]
      }

      entries.forEach((msg: any) => {
        msg.instanceName = instanceName
        msg.senderName = senderName
      })

      entries.forEach(messageCallback)
    }

    function setValue(destination: string, path: string, value: number) {
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
        function (err: any, _res: any) {
          if (err) {
            app.error(err)
          }
        }
      )
    }

    bus.connection.on('connect', () => {
      setPluginStatus(`Connected to ${address ? address : 'session bus'}`)
      if (pollInterval > 0) {
        const pollingTimer = setInterval(pollDbus, pollInterval * 1000)
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

    bus.connection.on('error', (error: any) => {
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
      (_d: any) => {}
    )
    bus.addMatch(
      "type='signal',interface='com.victronenergy.BusItem',member='ItemsChanged'",
      (_d: any) => {}
    )
    bus.addMatch("type='signal',member='NameOwnerChanged'", (_d: any) => {})
  })
}
