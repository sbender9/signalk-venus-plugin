#!/usr/bin/env python

from gi.repository import GLib  # pyright: ignore[reportMissingImports]
import platform
import logging
import sys
import os
from time import sleep, time
import json
import _thread

# import Victron Energy packages
sys.path.insert(1, os.path.join("/opt/victronenergy/dbus-mqtt", "ext", "velib_python"))
from vedbus import VeDbusService


class DbusMqttTemperatureService:
    def __init__(
        self,
        servicename,
        deviceinstance,
        paths,
        productname="SK Temperature",
        customname="SK Temperature",
        connection="SK Temperature service",
    ):
        self._dbusservice = VeDbusService(servicename)
        self._paths = paths

        logging.debug("%s /DeviceInstance = %d" % (servicename, deviceinstance))

        # Create the management objects, as specified in the ccgx dbus-api document
        self._dbusservice.add_path("/Mgmt/ProcessName", __file__)
        self._dbusservice.add_path(
            "/Mgmt/ProcessVersion",
            "Unkown version, and running on Python " + platform.python_version(),
        )
        self._dbusservice.add_path("/Mgmt/Connection", connection)

        # Create the mandatory objects
        self._dbusservice.add_path("/DeviceInstance", deviceinstance)
        self._dbusservice.add_path("/ProductId", 0xFFFF)
        self._dbusservice.add_path("/ProductName", productname)
        self._dbusservice.add_path("/CustomName", customname)
        self._dbusservice.add_path("/FirmwareVersion", "0.0.2 (20231218)")
        # self._dbusservice.add_path('/HardwareVersion', '')
        self._dbusservice.add_path("/Connected", 1)

        self._dbusservice.add_path("/Status", 0)
        self._dbusservice.add_path("/TemperatureType", type)

        for path, settings in self._paths.items():
            self._dbusservice.add_path(
                path,
                settings["initial"],
                gettextcallback=settings["textformat"],
                writeable=True,
                onchangecallback=self._handlechangedvalue,
            )

    def _handlechangedvalue(self, path, value):
        logging.debug("someone else updated %s to %s" % (path, value))
        return True  # accept the change


def main():
    _thread.daemon = True  # allow the program to quit

    from dbus.mainloop.glib import (  # pyright: ignore[reportMissingImports]
        DBusGMainLoop,
    )

    # Have a mainloop, so we can send/receive asynchronous calls to and from dbus
    DBusGMainLoop(set_as_default=True)

        # formatting
    def _celsius(p, v):
        return str("%.2f" % v) + "°C"

    def _percent(p, v):
        return str("%.1f" % v) + "%"

    def _pressure(p, v):
        return str("%i" % v) + "hPa"

    def _n(p, v):
        return str("%i" % v)

    paths_dbus = {
        "/Temperature": {"initial": None, "textformat": _celsius},
        "/Humidity": {"initial": None, "textformat": _percent},
        "/Pressure": {"initial": None, "textformat": _pressure},
        "/UpdateIndex": {"initial": 0, "textformat": _n},
    }
    
    DbusMqttTemperatureService(
        servicename="com.victronenergy.temperature.mqtt_temperature_100",
        deviceinstance=100,
        customname="SK Temperature",
        paths=paths_dbus,
    )

    logging.info(
        "Connected to dbus and switching over to GLib.MainLoop() (= event based)"
    )
    mainloop = GLib.MainLoop()
    mainloop.run()

if __name__ == "__main__":
    main()
