const dbus = require('dbus-native')
const debug = require('debug')('vedirect:dbus')

module.exports = function (messageCallback) {
  const bus = process.env.DBUS_SESSION_BUS_ADDRESS ? dbus.sessionBus() : dbus.systemBus()

  if (!bus) {
    throw new Error('Could not connect to the DBus session bus.')
  }

  // name owner (:0132 for example) is the key. In signals this is the sender
  // service name (com.victronenergy.battery.ttyO1) is the value
  var services = {}

  // get info on all existing D-Bus services at startup
  bus.listNames((props, args) => {
    args.forEach(name => {
      if ( name.startsWith('com.victronenergy') ) {
        bus.getNameOwner(name, (props, args) => {
          services[args] = { name: name }
          getDeviceInstanceForService(args, name)
        })
      }
    })
  })

  function signal_receive (m) {
    if (
      m.interface == 'com.victronenergy.BusItem' &&
      m.member == 'PropertiesChanged'
    ) {
      properties_changed(m)
    } else if (
      m.interface == 'org.freedesktop.DBus' &&
      m.member == 'NameOwnerChanged'
    ) {
      name_owner_changed(m)
    }
  }

  function name_owner_changed (m) {
    name = m.body[0]
    old_owner = m.body[1]
    new_owner = m.body[2]

    if (new_owner != '') {
      services[new_owner] = { name: name }
      getDeviceInstanceForService(new_owner, name)
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

    m.text = m.body[0][0][1][1][0]
    m.value = m.body[0][1][1][1][0]
    m.senderName = services[m.sender].name

    if (m.path == '/DeviceInstance') {
      services[m.sender].deviceInstance = m.value
      m.instanceName = m.value
    } else {
      m.instanceName = services[m.sender].deviceInstance
    }
  }

  bus.connection.on('message', signal_receive)
  bus.connection.on('message', messageCallback)
  bus.addMatch(
    "type='signal',interface='com.victronenergy.BusItem',member='PropertiesChanged'",
    d => {}
  )
  bus.addMatch("type='signal',member='NameOwnerChanged'", d => {})

  function getDeviceInstanceForService(owner, name) {
    var service = bus.getService(name);
    bus.invoke({
      path: '/DeviceInstance',
      destination: name,
      interface: 'com.victronenergy.BusItem',
      member: "GetValue"
    }, function(err, res) {
      if ( err ) {
        console.err(`error geting device instance for ${name} ${err}`)
      } else {
        services[owner].deviceInstance = res[1][0];
      }
    })
  }

  // TODO return a function to stop the dbus listener
  return () => {}
}
