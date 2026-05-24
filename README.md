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

## Custom mappings

Custom Mappings let you bring extra Venus MQTT values into Signal K without changing the plugin source code. This is intended for read-only mappings, for example when Node-RED on a Cerbo GX publishes custom values into the Venus MQTT tree and you want them to appear in Signal K.

You configure these in the plugin settings under `Custom Mappings`.

For each custom mapping, the fields are:

- `Venus Path`
  Enter the Venus path part that appears after the device section of the MQTT topic.
- `Interpret Venus Path As Regex`
  Leave this off for a normal exact match. Turn it on only when you want one mapping to match multiple similar Venus paths.
- `D-Bus Sender Filter`
  Optional. Use this when the same Venus path may appear under multiple devices and you only want one class of device. Leave blank for no restriction.
- `D-Bus Sender Match Mode`
  If you filled in `D-Bus Sender Filter`, choose whether it should be treated as a `Prefix` or `Exact` match.
- `Signal K Path`
  The Signal K path to write to.
- `Units`
  Optional Signal K units metadata.
- `Conversion`
  Optional value conversion.

The `Signal K Path` field supports these placeholders:

- `${instanceName}`
- `${venusName}`
- `${senderName}`

### How to choose the Venus Path

If the MQTT topic is:

`N/<portalId>/settings/0/Settings/SystemSetup/MaxChargeCurrent`

then the `Venus Path` value is:

`/Settings/SystemSetup/MaxChargeCurrent`

If the MQTT topic is:

`N/<portalId>/vebus/288/Dc/0/MaxChargeCurrent`

then the `Venus Path` value is:

`/Dc/0/MaxChargeCurrent`

### Example: exact match for one system setting

Suppose you want this MQTT topic:

`N/<portalId>/settings/0/Settings/SystemSetup/MaxChargeCurrent`

to appear in Signal K as:

`electrical.venus.maxChargeCurrent`

Fill out the custom mapping like this:

- `Venus Path`: `/Settings/SystemSetup/MaxChargeCurrent`
- `Interpret Venus Path As Regex`: off
- `D-Bus Sender Filter`: leave blank
- `Signal K Path`: `electrical.${venusName}.maxChargeCurrent`
- `Units`: `A`
- `Conversion`: `None`

### Example: match all VE.Bus devices with one rule

Suppose you have topics like:

- `N/<portalId>/vebus/276/Dc/0/MaxChargeCurrent`
- `N/<portalId>/vebus/288/Dc/0/MaxChargeCurrent`

and you want them to appear as:

- `electrical.chargers.276.maxChargeCurrent`
- `electrical.chargers.288.maxChargeCurrent`

Fill out the custom mapping like this:

- `Venus Path`: `^/Dc/0/MaxChargeCurrent$`
- `Interpret Venus Path As Regex`: on
- `D-Bus Sender Filter`: `com.victronenergy.vebus`
- `D-Bus Sender Match Mode`: `Prefix`
- `Signal K Path`: `electrical.chargers.${instanceName}.maxChargeCurrent`
- `Units`: `A`
- `Conversion`: `None`

The sender filter is useful because `/Dc/0/...` style paths are common in Venus. Without a sender filter, you might match more than just VE.Bus devices.

### Example: exact sender match

If you want a mapping to apply only to one specific D-Bus sender, use an exact match.

For example, for:

`N/<portalId>/settings/0/Settings/SystemSetup/MaxChargeCurrent`

you could fill out:

- `Venus Path`: `/Settings/SystemSetup/MaxChargeCurrent`
- `Interpret Venus Path As Regex`: off
- `D-Bus Sender Filter`: `com.victronenergy.settings.0`
- `D-Bus Sender Match Mode`: `Exact`
- `Signal K Path`: `electrical.${venusName}.maxChargeCurrent`
- `Units`: `A`

### Notes

- Use `Interpret Venus Path As Regex` only when you need it. Most mappings should be exact path matches.
- Leave `D-Bus Sender Filter` blank when the Venus path is specific enough by itself.
- Use `Prefix` sender matching when you want one rule to apply to a whole device family such as `com.victronenergy.vebus`.
