# venus-signalk

Depends on dbus-native, run npm install dbus-native

Then, for now, remove [line 300 from dbus-native/lib/bus.js](https://github.com/sidorares/dbus-native/blob/master/lib/bus.js#L300).

I don't know why yet, but for some reason the code in that library prohibits the user to register a
signal without requesting a name first. And on dbus it is not at all required to register a name for
that.

To run:

    nodejs dbus-listener.js

Once running, run a script that generates Venus style dbus data in another terminal. For example this
one: https://gist.github.com/mpvader/94672c05d68bb6762859ba70240ea887

The other file in this repo, `dbus-listener.py`, does more or less the same, but then written in
python.
