# venus-signalk

First run `npm install`.

Use ./demo.sh to run the code with full debug logging and the produced delta
serialised to stdout.

When not tested on an actual Venus device, there will be no output since there
is no data coming in. Use a dummy data script to test / develop on a pc:

https://gist.github.com/mpvader/94672c05d68bb6762859ba70240ea887

dbus-listener.py is an example of how similar data would be read in Python. It
is not required to use the plugin.
