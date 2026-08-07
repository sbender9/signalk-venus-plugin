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

- A. Connect to localhost via dbus
- B. Connect to a GX-device over tcp using MQTT (Plain text)
- C. Connect to a GX-device over tcp using MQTT (SSL)
- D. Connect via VRM

Use option A when signalk-server is installed on the GX-device itself.

Use option B or C in case signalk-server is a separate device, for example a raspberrypi running
Raspbian, in which case the plugin needs to connect to the GX-device
on the ethernet/wifi network. You should use SSL if GX-device is not on the local network.

When using option B or C go enter the hostname or ipaddress of the Venus device in the plugin configuration.

Also ensure that MQTT is turned on in the GX-devices Services Settings.

Option D is mostly usefull for developer testing/debugging with other peoples systems, but could also be used if running signalk in a different location or network that the GC device

## Battery cell voltages

If a battery is driven by a BMS that publishes per-cell data on dbus — most
commonly [dbus-serialbattery](https://github.com/mr-manuel/venus-os_dbus-serialbattery),
which supports JK, JBD/Xiaoxiang, Daly, ANT, Seplos and many other BMSs — the
individual cell voltages and balancing state are exposed under the battery
instance:

```
electrical.batteries.<instance>.cellVoltages.<n>.voltage     # volts
electrical.batteries.<instance>.cellVoltages.<n>.balancing   # 0 = idle, 1 = balancing
```

`<n>` is the 1-based cell number, matching the dbus paths and the convention
used by the `signalk-bms-ble` plugin. Any pack size and any number of battery
instances are handled automatically.

This requires the BMS driver to actually publish cell data. For
dbus-serialbattery that means its `BATTERY_CELL_DATA_FORMAT` is left at the
default (`1`) or set to `2`/`3`; with `0` no per-cell data is placed on dbus and
nothing can be mapped. Balancing is only available when that setting includes
bit 0 (values `1` and `3`). Managed/native batteries that only publish the
min/max cell summary rather than a full per-cell list will not produce these
paths.
