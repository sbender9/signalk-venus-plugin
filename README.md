# venus-signalk

This code is a [Signal K Node Server](https://github.com/SignalK/signalk-server-node) plugin. It
reads Victron data from a Venus-device, such as the
[Color Control GX](https://www.victronenergy.com/panel-systems-remote-monitoring/color-control) or the
[Venus GX](https://www.victronenergy.com/panel-systems-remote-monitoring/venus-gx) into Signal K.

Besides using those commercially available devices, it is also possible to run the
[Venus OS](https://github.com/victronenergy/venus/wiki) on a
[RaspberryPi2 or 3](https://github.com/victronenergy/venus/wiki/raspberrypi-install-venus-image),
for example.

Supported Victron products:
- Inverter/Chargers: Multis, Quattros
- Battery Monitors: any type that is supported by Venus. For example the BMV-700 series, or the
Lynx Shunt VE.Can, as well as various integrated Lithium battery systems.
- Solar Chargers: both the types with a VE.Direct and the types with a VE.Can connection
- Tank senders: the resistive inputs on the Venus GX, as well as a tank sender connected to Venus
over N2K

Instead of taking data from a Venus device over TCP, which is what this plugin is for when you install
it, it is also possible to run Signal K server on the Venus device itself. Possibly reducing one less
box from the boat. More information here:
https://github.com/SignalK/signalk-server-node/issues/517

## Support
Use the #victron channel on the [Signal K Slack](http://slack-invite.signalk.org/).

## Plugin installation & configuration
Installing is simple: the plugin is available in the signalk app store. Simply click to
install.

Then there are two settings. The first is how to connect to the Venus communication bus,
called D-Bus. Choose between these two:

- A. Connect to localhost
- B. Connect to a Venus device over tcp

Use option A when signalk-server is installed on the Venus itself. 

Use option B in case that signalk is one device, for example a raspberrypi running Raspbian, which needs to connect
to for example a Venus GX or Color Control GX elsewhere on the network.

When using option B enter in the ipaddress and port of the Venus device in the plugin configuration.

When using option B, it is also necessary to open up the port on the Venus device. It must be
configured to allow D-Bus connections via tcp, as its by default not binding its D-Bus daemon
to tcp. To make it do so, add these three lines exactly as they are to `/etc/dbus-1/system.conf` (above the `<policy context="default">` section) on the Venus device:
    
      <listen>tcp:host=0.0.0.0,port=78</listen>
      <auth>ANONYMOUS</auth>
      <allow_anonymous/>
    
Reboot afterwards. And also remember that any update of the Venus device will override these
(and any other) changes to the rootfs. Perhaps someday this can be added to Venus as a real
setting instead of a hack. __Make sure to only do this on a trusted network.__

To make above change, you'll need
[root access to the Venus device](https://www.victronenergy.com/live/ccgx:root_access).

## Test harness

To see data, without having actual Victron or other Venus compatible hardware setup,
get and run below explained Dummy data script. Or, clone
[dbus-recorder](https://github.com/victronenergy/dbus-recorder) and run play.sh.

Note that using the test harness will cause for some errors during init, as it
doesn't support doing a GetValue on the root item (/). See
https://github.com/mpvader/venus-signalk/issues/8 for details. For testing, there
errors are harmless.

## How to develop this plugin outside of Signal K

First run `npm install`.

Use ./demo.sh to run the code with full debug logging and the produced delta
serialised to stdout.

When not tested on an actual Venus device, there will be no output since there
is no data coming in. Use a dummy data script to test / develop on a pc:

https://gist.github.com/mpvader/94672c05d68bb6762859ba70240ea887

dbus-listener.py is an example of how similar data would be read in Python. It
is not required to use the plugin.
