#!/usr/bin/env python
# -*- coding: utf-8 -*-

from dbus.mainloop.glib import DBusGMainLoop
import gobject
from gobject import idle_add
import dbus
import dbus.service
import inspect
import logging
import argparse
import pprint
import traceback
import os

class SystemBus(dbus.bus.BusConnection):
	def __new__(cls):
		return dbus.bus.BusConnection.__new__(cls, dbus.bus.BusConnection.TYPE_SYSTEM)


class SessionBus(dbus.bus.BusConnection):
	def __new__(cls):
		return dbus.bus.BusConnection.__new__(cls, dbus.bus.BusConnection.TYPE_SESSION)


DBusGMainLoop(set_as_default=True)
bus = SessionBus() if 'DBUS_SESSION_BUS_ADDRESS' in os.environ else SystemBus()

# subscribe to NameOwnerChange for bus connect / disconnect events.
def name_owner_changed(name, oldowner, newowner):
	print("name: %s, oldowner: %s, newowner: %s" % (name, oldowner, newowner))

bus.add_signal_receiver(
	name_owner_changed,
	signal_name='NameOwnerChanged')


# Subscribe to PropertiesChanged for all services
def properties_changed(changes, path, senderId):
	print("changes: %s, path: %s, senderId: %s" % (changes, path, senderId))

bus.add_signal_receiver(
	properties_changed,
	dbus_interface='com.victronenergy.BusItem',
	signal_name='PropertiesChanged', path_keyword='path',
	sender_keyword='senderId')

gobject.MainLoop().run()
