# This file is no longer used.

Please see [Releases](https://github.com/sbender9/signalk-venus-plugin/releases)

## Change Log

### v1.24.4 (2021/03/14 15:43 +00:00)

- [#77](https://github.com/sbender9/signalk-venus-plugin/pull/77) fix: silenced notifications not staying silenced (@sbender9)

### v1.24.3 (2021/03/13 19:28 +00:00)

- [#75](https://github.com/sbender9/signalk-venus-plugin/pull/75) fix: don't send "normal" notifications unless needed (@sbender9)

### v1.24.2 (2021/03/13 18:56 +00:00)

- [#74](https://github.com/sbender9/signalk-venus-plugin/pull/74) fix: don't ignore all null values coming over mqtt (@sbender9)
- [#73](https://github.com/sbender9/signalk-venus-plugin/pull/73) fix: preserve existing notification methods (@sbender9)

### v1.24.1 (2021/02/28 16:16 +00:00)

- [#72](https://github.com/sbender9/signalk-venus-plugin/pull/72) fix: relay display name entry not showing in plugin configuration (@sbender9)

### v1.24.0 (2021/02/28 16:06 +00:00)

- [#70](https://github.com/sbender9/signalk-venus-plugin/pull/70) fix: errors when a device goes away (@sbender9)
- [#71](https://github.com/sbender9/signalk-venus-plugin/pull/71) feature: add the ability to specify Display Name meta for relays (@sbender9)

### v1.23.2 (2021/02/27 00:10 +00:00)

- [#69](https://github.com/sbender9/signalk-venus-plugin/pull/69) fix: some mqtt values not getting refreshed (@sbender9)

### v1.23.1 (2021/02/26 23:53 +00:00)

- [#68](https://github.com/sbender9/signalk-venus-plugin/pull/68) fix: mqtt connection dropping after a minute (@sbender9)

### v1.23.0 (2021/02/26 20:33 +00:00)

- [#67](https://github.com/sbender9/signalk-venus-plugin/pull/67) fix: limit default debug logging (@sbender9)
- [#66](https://github.com/sbender9/signalk-venus-plugin/pull/66) feature: add support to get data via mqtt (@sbender9)
- [#65](https://github.com/sbender9/signalk-venus-plugin/pull/65) README: add warning about modifying the dbus conf (@mpvader)

### v1.22.1 (2021/02/10 15:17 +00:00)

- [#64](https://github.com/sbender9/signalk-venus-plugin/pull/64) fix: units for venus temperatures are wrong (@sbender9)

### v1.22.0 (2020/11/24 02:26 +00:00)

- [#61](https://github.com/sbender9/signalk-venus-plugin/pull/61) doc: improve dbus tcp instructions (@tkurki)
- [#62](https://github.com/sbender9/signalk-venus-plugin/pull/62) feature: send meta deltas (@sbender9)

### v1.21.0 (2020/07/15 13:30 +00:00)

- [#57](https://github.com/sbender9/signalk-venus-plugin/pull/57) refactor: change "Blacklist" to "Block List" in the UI (@sbender9)
- [#42](https://github.com/sbender9/signalk-venus-plugin/pull/42) add frequency and discharge capacity (@dpreuss)

### v1.20.0 (2020/07/05 18:37 +00:00)

- [#56](https://github.com/sbender9/signalk-venus-plugin/pull/56) feature: add Inverter Only option for MultiPlus switch (@sbender9)

### v1.19.0 (2020/07/03 17:25 +00:00)

- [#55](https://github.com/sbender9/signalk-venus-plugin/pull/55) fix: unable to save the plugin config when there are no know paths (@sbender9)
- [#54](https://github.com/sbender9/signalk-venus-plugin/pull/54) feature: add ability to map vebus paths (@sbender9)
- [#53](https://github.com/sbender9/signalk-venus-plugin/pull/53) fix: mappings not always working (@sbender9)

### v1.18.4 (2020/06/30 21:15 +00:00)

- [#52](https://github.com/sbender9/signalk-venus-plugin/pull/52) fix: /Ac/L\*/Volage typo (@sbender9)

### v1.18.3 (2020/06/30 21:03 +00:00)

- [#51](https://github.com/sbender9/signalk-venus-plugin/pull/51) fix: remove adding generic data for unknown data (@sbender9)

### v1.18.2 (2020/06/30 20:45 +00:00)

- [#50](https://github.com/sbender9/signalk-venus-plugin/pull/50) fix: /Ac/L\*/Voltage has the wrong path (@sbender9)

### v1.18.1 (2020/06/26 23:43 +00:00)

- [#49](https://github.com/sbender9/signalk-venus-plugin/pull/49) fix: grid paths incorrect (@sbender9)

### v1.18.0 (2020/06/26 23:30 +00:00)

- [#48](https://github.com/sbender9/signalk-venus-plugin/pull/48) feature: add support for com.victronenergy.grid (@sbender9)

### v1.17.0 (2020/05/31 17:04 +00:00)

- [#46](https://github.com/sbender9/signalk-venus-plugin/pull/46) feature: add ability to blacklist specific paths (@sbender9)

### v1.16.0 (2020/05/18 21:20 +00:00)

- [#45](https://github.com/sbender9/signalk-venus-plugin/pull/45) feature: add option to disable getting position from Venus OS (@sbender9)

### v1.15.0 (2020/03/31 13:02 +00:00)

- [#44](https://github.com/sbender9/signalk-venus-plugin/pull/44) feature: add support for temperature sensors (@sbender9)
- [#43](https://github.com/sbender9/signalk-venus-plugin/pull/43) fix: convert kWh to Joules for solar yield (@sbender9)

### v1.14.2 (2020/03/06 18:44 +00:00)

- [#40](https://github.com/sbender9/signalk-venus-plugin/pull/40) fix: initial tank values updated at 'tanks.unknown' (@sbender9)

### v1.14.1 (2020/01/10 23:07 +00:00)

- [#39](https://github.com/sbender9/signalk-venus-plugin/pull/39) fix: gps values from dbus not working (@sbender9)

### v1.14.0 (2019/08/22 19:47 +00:00)

- [#37](https://github.com/sbender9/signalk-venus-plugin/pull/37) feature: support changing the vebus mode (@sbender9)

### v1.13.1 (2019/08/17 21:30 +00:00)

- [#36](https://github.com/sbender9/signalk-venus-plugin/pull/36) fix: battery relay state overwriting Venus relay 0 state (@sbender9)

### v1.13.0 (2019/06/27 12:51 +00:00)

- [#35](https://github.com/sbender9/signalk-venus-plugin/pull/35) feature: replace source with $source (@tkurki)

### v1.12.1 (2019/06/19 05:22 +00:00)

- [#34](https://github.com/sbender9/signalk-venus-plugin/pull/34) fix: gray/waste water tank not named correctly (@sbender9)

### v1.12.0 (2019/05/22 00:48 +00:00)

- [#33](https://github.com/sbender9/signalk-venus-plugin/pull/33) feature: provide total solar current and power (@sbender9)
- [#32](https://github.com/sbender9/signalk-venus-plugin/pull/32) feature: show state of digital inputs (@sbender9)

### v1.11.0 (2019/05/20 20:18 +00:00)

- [#31](https://github.com/sbender9/signalk-venus-plugin/pull/31) fix: absorption misspelled (@MichelleWhy)
- [#30](https://github.com/sbender9/signalk-venus-plugin/pull/30) fix: stateMaps for solarcharger to correct charging mode (@MichelleWhy)
- [#28](https://github.com/sbender9/signalk-venus-plugin/pull/28) feature: add ability to map venus instance numbers to different sk numbers (@sbender9)
- [#25](https://github.com/sbender9/signalk-venus-plugin/pull/25) chore: add license (@tkurki)
- [#24](https://github.com/sbender9/signalk-venus-plugin/pull/24) docs: remove outdated INSTALL-ON-VENUS & link to new info (@mpvader)
- [#23](https://github.com/sbender9/signalk-venus-plugin/pull/23) docs: Insert config above <policy context="default"> (@webmasterkai)

### v1.10.0 (2018/08/15 17:57 +00:00)

- [#22](https://github.com/sbender9/signalk-venus-plugin/pull/22) feature: provide status to the server (@sbender9)

### v1.9.0 (2018/08/11 16:45 +00:00)

- [#21](https://github.com/sbender9/signalk-venus-plugin/pull/21) feature: allow the signalk path name for the relays to be configured (@sbender9)

### v1.8.0 (2018/07/01 20:09 +00:00)

- [#19](https://github.com/sbender9/signalk-venus-plugin/pull/19) fix: send out null deltas for unknown values (@sbender9)
- [#20](https://github.com/sbender9/signalk-venus-plugin/pull/20) feature: add ESS mode for solar chargers (@sbender9)

### v1.7.0 (2018/05/29 21:22 +00:00)

- [#18](https://github.com/sbender9/signalk-venus-plugin/pull/18) feature: allow the poll interval to be configured (@sbender9)

### v1.6.1 (2018/05/25 01:53 +00:00)

- [#17](https://github.com/sbender9/signalk-venus-plugin/pull/17) fix: tank type names were not correct per the spec (@sbender9)

### v1.6.0 (2018/04/18 13:54 +00:00)

- [#16](https://github.com/sbender9/signalk-venus-plugin/pull/16) feature: added /ConsumedAmphours as electrical.batteries.{instance}.capacity.consumedCharge (@sbender9)

### v1.5.3 (2018/04/16 14:25 +00:00)

- [#15](https://github.com/sbender9/signalk-venus-plugin/pull/15) fix: store /Dc/1/Voltage under batteries.{instance}-second.voltage (@sbender9)

### v1.5.2 (2018/03/21 22:32 +00:00)

- [#14](https://github.com/sbender9/signalk-venus-plugin/pull/14) fix: crash when an alarm is on (@sbender9)

### v1.5.0 (2018/03/19 18:47 +00:00)

- [#13](https://github.com/sbender9/signalk-venus-plugin/pull/13) change: updated to latest server PUT api's (@sbender9)

### v1.4.0 (2018/03/14 00:35 +00:00)

- [#12](https://github.com/sbender9/signalk-venus-plugin/pull/12) chore: change relays paths to closer match current spec RFC (@sbender9)
- [#11](https://github.com/sbender9/signalk-venus-plugin/pull/11) feature: add support to switch relays using PUT (@sbender9)

### v1.3.0 (2018/02/28 01:39 +00:00)

- [#10](https://github.com/sbender9/signalk-venus-plugin/pull/10) Add reconnecting to remote dbus (@tkurki)

### v1.2.0 (2018/02/23 04:06 +00:00)

- [#8](https://github.com/sbender9/signalk-venus-plugin/pull/8) add polling of dbus (@mpvader)

### v1.1.3 (2018/02/19 03:36 +00:00)

- [#5](https://github.com/sbender9/signalk-venus-plugin/pull/5) fix timer reset when lost dbus, smaller refactorings and fixes (@tkurki)
- [#3](https://github.com/sbender9/signalk-venus-plugin/pull/3) add ipk files & instructions for installing (@mpvader)
- [#2](https://github.com/sbender9/signalk-venus-plugin/pull/2) README.md: update instructions & remove signalk basics (@mpvader)
- [#1](https://github.com/sbender9/signalk-venus-plugin/pull/1) Multiple updates (@sbender9)
