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

Besides taking data from a Venus device, over TCP, its also possible to run Signal K server on the
Venus device itself.

## Support
Use the #victron channel on the [Signal K Slack](http://slack-invite.signalk.org/).

## Plugin installation & configuration
Install the plugin by running `npm install mpvader/venus-signalk` from the node_modules directory
in your Signal K install.

Restart signalk-noder-server. It will automatically pick-up the new plugin.

Then configure it from the Signal K website, usually available on `http://[ip-address]:3000/`

First, configure how to connect to the Venus D-bus:
1. Connect to localhost (choose this when the Signal K server is running on the Venus device
2. Connect to a Venus device over tcp

Then, only when option 2 was chosen, set the right address. Besides setting that address, the
Venus device must in this case also be configured to allow D-Bus connections via tcp, as its by
default not binding its D-Bus daemon to tcp. To make it do so, add these three lines to
`/etc/dbus-1/system.conf` on the Venus device:
    
      <listen>tcp:host=0.0.0.0,port=78</listen>
      <auth>ANONYMOUS</auth>
      <allow_anonymous/>
    
Reboot afterwards. And also remember that any update of the Venus device will override these
(and any other) changes to the rootfs. Perhaps someday this can be added to Venus as a real
setting instead of a hack. __Make sure to only do this on a trusted network.__

To make above change, you'll need
[root access to the Venus device](https://www.victronenergy.com/live/ccgx:root_access).

## How to install Signal K Node Server & this plugin

Ofcourse, the proper thing to do is to read the signalk docs. But for the impatient souls
such as myself, herewith a short instruction to get up & running:

- Install nodejs. Version 6 or newer.
- Clone signalk node server.
- Go into the dir and run `npm install`. This will install all dependencies in a
  subdir names `node_modules`
- Then run `npm install mpvader/venus-signalk`. This install this repo in to the
  same `node_modules` dir.
- Then go back to the root of signa lk node server, and start it:

```
$ ./bin/signalk-server
signalk-server running at 0.0.0.0:3000

Error reading /home/matthijs/dev/signalk-server-node/public/mapcache
GET / 304 4.750 ms - -
GET /bootstrap/dist/css/bootstrap.min.css 304 4.364 ms - -
GET /jquery/dist/jquery.min.js 304 2.982 ms - -
GET /plugins/configure/ 304 0.620 ms - -
GET /bootstrap/dist/css/bootstrap.min.css 304 2.124 ms - -
GET /jquery/dist/jquery.min.js 304 2.094 ms - -
GET /bootstrap/dist/js/bootstrap.min.js 304 1.862 ms - -
GET /plugins/configure/main.js 304 1.425 ms - -
GET /plugins 200 3.164 ms - 26342
... etcetera
```

- Open a browser and navigate to http://127.0.0.1/ to get to its config.

And then there is plenty more, see signalk docs for that.

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
