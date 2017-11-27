# venus-signalk

A [SignalK Node Server](https://github.com/SignalK/signalk-server-node) plugin. To
receive [Venus OS]()-style D-Bus signals to go into Signal K.

## How to run in SignalK Node Server

Ofcourse, read the signalk docs is what should be done. But for the impatient souls
like me a short instruction to get up & running:

- Install nodejs. Version 6 or newer.
- Clone signalk node server.
- Go into the dir and run `npm install`. This will install all dependencies in a
  subdir names `node_modules`
- Then run `npm install mpvader/venus-signalk`. This install this repo in to the
  same `node_modules` dir.
- Then go back to the root of signalk node server, and start it:

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

## How to develop outside of Signal K

First run `npm install`.

Use ./demo.sh to run the code with full debug logging and the produced delta
serialised to stdout.

When not tested on an actual Venus device, there will be no output since there
is no data coming in. Use a dummy data script to test / develop on a pc:

https://gist.github.com/mpvader/94672c05d68bb6762859ba70240ea887

dbus-listener.py is an example of how similar data would be read in Python. It
is not required to use the plugin.
