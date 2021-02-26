# venus-signalk

This code is a [Signal K Node Server](https://github.com/SignalK/signalk-server-node) plugin. It
reads data from a Victron GX-device, such as the
[Cerbo GX](https://www.victronenergy.com/panel-systems-remote-monitoring/cerbo-gx) into signalk-server.

Besides using the Cerbo GX, or any of the other commercially available GX devices, it is also
possible to run [Venus OS](https://github.com/victronenergy/venus/wiki) on a
[RaspberryPi2 or 3](https://github.com/victronenergy/venus/wiki/raspberrypi-install-venus-image),
for example.

Supported Victron products:
- Inverter/Chargers: Multis, Quattros
- Battery Monitors: any type that is supported by Venus. For example the BMV-700 series, or the
Lynx Shunt VE.Can, as well as various integrated Lithium battery systems.
- Solar Chargers: both the types with a VE.Direct and the types with a VE.Can connection
- Tank senders: the resistive inputs on the Venus GX, as well as a tank sender connected to Venus
over N2K

Know that there is also a version of Venus OS with signalk-server, and this plug-in pre-installed.
In which case you don't need to self install or configure this plugin. See
[Venus OS large](https://www.victronenergy.com/live/venus-os:large).

## Support
Use the #victron channel on the [Signal K Slack](http://slack-invite.signalk.org/).

## Plugin installation & configuration
Installing is simple, though do read and heed the warning below (!). The plugin is available in the signalk app store. Simply click to
install.

Then there are two settings. The first is how to connect to the Venus communication bus,
called D-Bus. Choose between these:

- A. Connect to localhost
- B. Connect to a GX-device over tcp using MQTT (Plain text)
- C. Connect to a GX-device over tcp using MQTT (SSL)

Use option A when signalk-server is installed on the GX-device itself. 

Use option B or C in case signalk-server is a separate device, for example a raspberrypi running
Raspbian, in which case the plugin needs to connect to the GX-device
on the ethernet/wifi network. You should use SSL if GX-device is not on the local network. 

When using option B or C go enter the hostname or ipaddress of the Venus device in the plugin configuration.

Also ensure that MQTT is turned on in the GX-devices Services Settings.

## Test harness

To see data, without having actual Victron or other Venus compatible hardware setup,
get and run below explained Dummy data script. Or, clone
[dbus-recorder](https://github.com/victronenergy/dbus-recorder) and run play.sh.

Note that using the test harness could cause for some errors during init, as it
doesn't support doing a GetValue on the root item (/).

## How to develop this plugin outside of Signal K

First run `npm install`.

Use ./demo.sh to run the code with full debug logging and the produced delta
serialised to stdout.

When not tested on an actual Venus device, there will be no output since there
is no data coming in. Use a dummy data script to test / develop on a pc:

https://gist.github.com/mpvader/94672c05d68bb6762859ba70240ea887

dbus-listener.py is an example of how similar data would be read in Python. It
is not required to use the plugin.
