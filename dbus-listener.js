const dbus = require('dbus-native');
const bus = dbus.sessionBus();

if (!bus) {
	throw new Error('Could not connect to the DBus session bus.');
}

var services = {};

function signal_receive(m) {
	if (m.interface == 'com.victronenergy.BusItem' && m.member == 'PropertiesChanged') {
		properties_changed(m);
	} else if (m.interface == 'org.freedesktop.DBus' && m.member == 'NameOwnerChanged') {
		name_owner_changed(m);
	}
}

function name_owner_changed(m) {
	name = m.body[0];
	old_owner = m.body[1];
	new_owner = m.body[2];

	if (new_owner != '') {
		services[new_owner] = name;
	} else {
		delete services[old_owner];
	}
}

function properties_changed(m) {
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

	m.text  = m.body[0][0][1][1][0];
	m.value = m.body[0][1][1][1][0];

	console.log("Receiving signal %d", m.serial);
	console.log("  " + m.path);              // '/Dc/0/Voltage'
	console.log("  " + m.sender);            // ':1.104'
	console.log("  " + services[m.sender]);  // 'com.victronenergy.battery.ttyO1'
	console.log("  " + m.text);              // The new value as a (sometimes formatted) string
	console.log("  " + m.value);             // The new value as a plain value
	console.log("  " + Object.prototype.toString.call(m.value))

	return true;
}

bus.connection.on('message', signal_receive);
bus.addMatch("type='signal',interface='com.victronenergy.BusItem',member='PropertiesChanged'", d => {});
bus.addMatch("type='signal',member='NameOwnerChanged'",	d => {});
