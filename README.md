# venus-signalk

This code is a [Signal K Node Server](https://github.com/SignalK/signalk-server-node) plugin. It
reads data from a Victron GX-device, such as the
[Cerbo GX](https://www.victronenergy.com/panel-systems-remote-monitoring/cerbo-gx) into signalk-server.

Besides using the Cerbo GX, or any of the other commercially available GX devices, it is also
possible to run [Venus OS](https://github.com/victronenergy/venus/wiki) on a
[RaspberryPi2 or 3](https://github.com/victronenergy/venus/wiki/raspberrypi-install-venus-image),
for example.

Know that there is also a version of Venus OS with signalk-server, and this plug-in pre-installed.
In which case you don't need to self install or configure this plugin. See
[Venus OS large](https://www.victronenergy.com/live/venus-os:large).

## Support
Use the #victron channel on [Discord](https://discord.gg/uuZrwz4dCS).

## Plugin installation & configuration
Installing is simple. The plugin is available in the signalk app store. Simply click to install.

Then there are two settings. The first is how to connect to Venus OS. Choose between these:

- A. Connect to localhost
- B. Connect to a GX-device over tcp using MQTT (Plain text)
- C. Connect to a GX-device over tcp using MQTT (SSL)

Use option A when signalk-server is installed on the GX-device itself. 

Use option B or C in case signalk-server is a separate device, for example a raspberrypi running
Raspbian, in which case the plugin needs to connect to the GX-device
on the ethernet/wifi network. You should use SSL if GX-device is not on the local network. 

When using option B or C go enter the hostname or ipaddress of the Venus device in the plugin configuration.

Also ensure that MQTT is turned on in the GX-devices Services Settings.
