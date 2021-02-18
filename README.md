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
called D-Bus. Choose between these two:

- A. Connect to localhost
- B. Connect to a GX-device over tcp

Use option A when signalk-server is installed on the GX-device itself. 

Use option B in case signalk-server is a separate device, for example a raspberrypi running
Raspbian, in which case the plugin needs to connect to the GX-device
on the ethernet/wifi network.

When using option B enter in the ipaddress and port of the Venus device in the plugin configuration.

When using option B, it is also necessary to open up the port on the Venus device. It must be
configured to allow D-Bus connections via tcp, as its by default not binding its D-Bus daemon
to tcp. To make it do so, add these three lines exactly as they are to `/etc/dbus-1/system.conf` (above the `<policy context="default">` section) on the Venus device:
    
      <listen>tcp:host=0.0.0.0,port=78</listen>
      <auth>ANONYMOUS</auth>
      <allow_anonymous/>

Now double check and extremely carefully make sure no mistake is made in editing that dbus config file.

WARNING: a typo or other error in there will brick the GX-device. And requires a special serial console
cable or other procedure to recover it. And -obviously- all these changes are on your own
risk and not covered by (Victron) warranty nor (Victron) support.

Reboot afterwards. And also remember that any update of the GX-device will override these
(and any other) changes to the rootfs.

__Lastly: make sure to only open D-Bus on TCP on a trusted network, its not secure at all.__

To make above change, you'll need
[root access to the Venus device](https://www.victronenergy.com/live/ccgx:root_access).

## Recovering a bricked GX-device

In case you did make a mistake in the config file, and now your GX is in an endless reboot
loop; here is what to do.

For the CCGX I don't know how to recover it. Try checking
[this thread](https://community.victronenergy.com/questions/78081/recovering-a-ccgx.html).

For all other models, best is to get a serial console cable. See the Venus OS root access
document for how to connect it.

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
