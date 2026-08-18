/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

const dbus = require('dbus-native')
const _ = require('lodash')
const camelcase = require('camelcase')
import { Message } from './venusToDeltas'
import { ServerAPI, Plugin } from '@signalk/server-api'

export class DbusListener {
  private app: ServerAPI
  private messageCallback: (m: Message) => void
  private address: string
  private plugin: Plugin
  private pollInterval: number
  private bus: any
  private services: { [key: string]: any } = {}
  private pollingTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectDelay: number = 5000
  private options: any
  private heartbeatTimer: NodeJS.Timeout | null = null
  private heartbeatInterval: number = 15000
  private linkLossTimeout: number
  private lastActivity: number = Date.now()
  private stopped: boolean = false

  constructor(
    app: ServerAPI,
    messageCallback: (m: Message) => void,
    address: string,
    plugin: Plugin,
    options: any
  ) {
    this.app = app
    this.messageCallback = messageCallback
    this.address = address
    this.plugin = plugin
    this.pollInterval = options.pollInterval || 20
    this.linkLossTimeout = (options.linkLossTimeout || 60) * 1000
    this.options = options
    this.connect()
  }

  private connect() {
    const msg = `connecting to ${this.address || 'local bus'}`
    this.app.setPluginStatus(msg)
    this.app.debug(msg)

    if (this.address) {
      this.bus = dbus.createClient({
        busAddress: this.address,
        authMethods: ['ANONYMOUS']
      })
    } else {
      this.bus = process.env.DBUS_SESSION_BUS_ADDRESS
        ? dbus.sessionBus()
        : dbus.systemBus()
    }

    if (!this.bus) {
      const msg = 'Could not connect to the D-Bus'
      this.app.setPluginError(msg)
      throw new Error(msg)
    }

    // Enable TCP keepalive so a dead socket on a remote/TCP connection gets
    // noticed by the OS. This alone isn't reliable enough (keepalive timeouts
    // can be very long/disabled on some platforms), so it's paired with the
    // application-level watchdog started below.
    const stream = this.bus.connection && this.bus.connection.stream
    if (stream && typeof stream.setKeepAlive === 'function') {
      stream.setKeepAlive(true, 10000)
    }

    // get info on all existing D-Bus services at startup
    this.bus.listNames((_props: any, args: string[]) => {
      args.forEach((name) => {
        if (name.startsWith('com.victronenergy')) {
          this.bus.getNameOwner(name, (_props: any, args: string) => {
            this.initService(args, name)
          })
        }
      })
    })

    this.bus.connection.on('connect', () => {
      this.app.setPluginStatus(
        `Connected to ${this.address ? this.address : 'session bus'}`
      )
      if (this.pollInterval > 0) {
        this.pollingTimer = setInterval(
          this.pollDbus.bind(this),
          this.pollInterval * 1000
        )
      }
      this.startWatchdog()
    })

    // if resolved within timeout reject has no effect
    //setTimeout(() => reject('Timeout waiting for connection'), 10 * 1000)

    this.bus.connection.on('message', this.signal_receive.bind(this))

    this.bus.connection.on('error', this.connectionLost.bind(this))

    this.bus.connection.on('end', this.connectionLost.bind(this))

    this.bus.addMatch(
      "type='signal',interface='com.victronenergy.BusItem',member='PropertiesChanged'",
      (_d: any) => {}
    )
    this.bus.addMatch(
      "type='signal',interface='com.victronenergy.BusItem',member='ItemsChanged'",
      (_d: any) => {}
    )
    this.bus.addMatch(
      "type='signal',member='NameOwnerChanged'",
      (_d: any) => {}
    )
  }

  stop() {
    this.stopped = true
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopWatchdog()
    if (this.bus && this.bus.connection) {
      this.bus.connection.removeAllListeners()
    }
    this.bus = null
    this.services = {}
    this.app.setPluginStatus('D-Bus connection stopped')
  }

  connectionLost(err: any) {
    if (this.stopped) {
      return
    }
    const msg = `no connection to D-Bus ${err ? err.message : ''}`
    this.app.setPluginError(msg)
    this.app.error(msg)
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
    this.stopWatchdog()
    this.bus = null
    this.services = {}
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.app.setPluginStatus('retrying D-Bus connection')
      this.app.error('retrying D-Bus connection')
      this.connect()
    }, this.reconnectDelay)
  }

  // Detects a D-Bus connection that has gone silently dead (no socket
  // 'error'/'end' event fires for a half-open TCP connection or a wedged
  // dbus-native stream). Actively pings the bus at heartbeatInterval and
  // forces a reconnect if no activity at all is observed within
  // linkLossTimeout, regardless of whether the ping itself ever comes back.
  private startWatchdog() {
    this.stopWatchdog()
    this.lastActivity = Date.now()
    this.heartbeatTimer = setInterval(
      this.checkLinkHealth.bind(this),
      this.heartbeatInterval
    )
  }

  private stopWatchdog() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private checkLinkHealth() {
    if (this.stopped || !this.bus) {
      return
    }

    const idleTime = Date.now() - this.lastActivity
    if (idleTime > this.linkLossTimeout) {
      this.app.debug(
        `D-Bus watchdog: no activity for ${Math.round(idleTime / 1000)}s, forcing reconnect`
      )
      this.forceReconnect()
      return
    }

    // Actively probe the bus so silence doesn't just mean "nothing changed" -
    // if the socket is dead this call will simply never return, and the
    // idleTime check above will eventually trip.
    this.bus.listNames((_props: any, _args: any) => {
      this.lastActivity = Date.now()
    })
  }

  private forceReconnect() {
    const bus = this.bus
    if (bus && bus.connection) {
      bus.connection.removeAllListeners()
      if (bus.connection.stream) {
        try {
          bus.connection.stream.destroy()
        } catch (_e) {
          // socket already gone, nothing to clean up
        }
      }
    }
    this.bus = null
    this.connectionLost(new Error('watchdog: no D-Bus activity detected'))
  }

  private pollDbus() {
    _.values(this.services).forEach((service: any) => {
      this.requestRoot(service)
    })
  }

  private initService(owner: string, name: string) {
    const service = { name: name }
    this.services[owner] = service

    this.app.debug(`${name} is sender ${owner}`)

    // Check if this is a virtual device from Signal K Virtual BMV plugin
    this.bus.invoke(
      {
        path: '/Mgmt/ProcessName',
        destination: name,
        interface: 'com.victronenergy.BusItem',
        member: 'GetValue'
      },
      (err: any, res: any) => {
        if (!err && res[1][0] === 'signalk-virtual-device') {
          this.app.debug(`Ignoring virtual device ${name} created by Signal K`)
          delete this.services[owner]
          return
        }

        // Continue with normal service initialization
        this.bus.invoke(
          {
            path: '/DeviceInstance',
            destination: name,
            interface: 'com.victronenergy.BusItem',
            member: 'GetValue'
          },
          (err: any, res: any) => {
            if (err) {
              // There are several dbus services that don't have the /DeviceInstance
              // path. They are services that are not interesting for signalk, like
              // a process to manage settings on the dbus, the logger to VRM Portal
              // and others. All services that send out data for connected devices do
              // have the /DeviceInstance path.
              if (this.services[owner]) {
                this.app.debug(
                  `warning: error getting device instance for ${name}`
                )
                this.services[owner].deviceInstance = 99
              }
            } else {
              this.services[owner].deviceInstance = res[1][0]
            }

            if (
              this.options.useDeviceNames !== undefined &&
              this.options.useDeviceNames
            ) {
              ;(this.app as any).debug('requesting custom name for %s', name)
              this.bus.invoke(
                {
                  path: '/CustomName',
                  destination: name,
                  interface: 'com.victronenergy.BusItem',
                  member: 'GetValue'
                },
                (err: any, res: any) => {
                  if (!err) {
                    const customName: string = res[1][0]
                    ;(this.app as any).debug(
                      'got custom name %s for %s',
                      customName,
                      name
                    )
                    this.services[owner].customName = camelcase(customName)
                  } else {
                    this.services[owner].customName = ''
                  }
                  this.requestRoot(service)
                }
              )
            } else {
              this.requestRoot(service)
            }
          }
        )
      }
    )
  }

  private requestRoot(service: any) {
    // app.debug(`getValue / ${service.name}`)
    this.bus.invoke(
      {
        path: '/',
        destination: service.name,
        interface: 'com.victronenergy.BusItem',
        member: 'GetValue'
      },
      (err: any, res: any) => {
        this.lastActivity = Date.now()
        if (err) {
          // Some services don't support requesting the root path. They are not
          // interesting to signalk, see above in the comments on /DeviceInstance
          this.app.debug(
            `warning: error during GetValue on / for ${service.name} ${err}`
          )
        } else {
          const data: any = {}

          if (res[0][0].type == 'a') {
            res[1][0].forEach((kp: any) => {
              data[kp[0]] = kp[1][1][0]
            })
          } else {
            //for some reason virtual devices come in this way
            res.forEach((kp: any) => {
              data[kp[0]] = kp[1][1][0]
            })
          }

          service.deviceInstance = data.DeviceInstance

          if (!_.isUndefined(data.FluidType)) {
            service.fluidType = data.FluidType
          }

          if (!_.isUndefined(data.TemperatureType)) {
            service.temperatureType = data.TemperatureType
          }

          if (
            service.name.startsWith('com.victronenergy.switch') &&
            !_.isUndefined(data.Type)
          ) {
            data.switchType = data.Type
          }

          // app.debug(`${service.name} ${JSON.stringify(data)}`)

          let deviceInstance: string | undefined = undefined

          /*
        //FIXME: paths that don't require instance??
        if ( _.isUndefined(deviceInstance) ) {
          return
          }
        */

          if (this.options.instanceMappings) {
            const mapping = this.options.instanceMappings.find(
              (mapping: any) => {
                return (
                  service.name.startsWith(mapping.type) &&
                  mapping.venusId == service.deviceInstance
                )
              }
            )
            if (!_.isUndefined(mapping)) {
              deviceInstance = mapping.signalkId
            }
          }

          if (deviceInstance === undefined) {
            if (
              this.options.useDeviceNames !== undefined &&
              this.options.useDeviceNames &&
              service.customName !== ''
            ) {
              deviceInstance = service.customName
            } else deviceInstance = service.deviceInstance
          }

          _.keys(data).forEach((path: string) => {
            const msg: Message = {
              path: '/' + path,
              senderName: service.name,
              value: data[path],
              instanceName: deviceInstance!,
              fluidType: service.fluidType,
              temperatureType: service.temperatureType,
              switchType: service.switchType
            }
            this.messageCallback(msg)
          })
        }
      }
    )
  }

  private signal_receive(m: any) {
    this.lastActivity = Date.now()
    if (
      m.interface === 'com.victronenergy.BusItem' &&
      (m.member === 'PropertiesChanged' || m.member === 'ItemsChanged')
    ) {
      this.properties_changed(m)
    } else if (
      m.interface == 'org.freedesktop.DBus' &&
      m.member == 'NameOwnerChanged'
    ) {
      this.name_owner_changed(m)
    }
  }

  private name_owner_changed(m: any) {
    const name = m.body[0]
    const old_owner = m.body[1]
    const new_owner = m.body[2]

    ;(this.app as any).debug('name owner change: %j', m)

    if (
      name.startsWith('com.victronenergy') &&
      new_owner &&
      new_owner.length > 0
    ) {
      this.initService(new_owner, name)
    } else {
      delete this.services[old_owner]
    }
  }

  private setValueAndText(data: any, res: any) {
    data.forEach((entry: any) => {
      if (entry[0] == 'Text') {
        res.text = entry[1][1][0]
      } else if (entry[0] == 'Value') {
        res.value = entry[1][1][0]
      }
    })
    return res
  }

  private properties_changed(m: any) {
    // Message contents:
    // { serial: 5192,
    //   path: '/Dc/0/Power',
    //   interface: 'com.victronenergy.BusItem',
    //   member: 'PropertiesChanged',
    //   signature: 'a{sv}',
    //   sender: ':1.104',
    //   type: 4,
    //   flags: 1,
    //   body: [ [ [Object], [Object] ] ]}

    const sender = m.sender
    const service = this.services[sender]

    if (!service || !service.name || service.deviceInstance === undefined) {
      // See comment above explaining why some services don't have the
      // /DeviceInstance path
      // this.app.debug(`warning: unknown service; ${m.sender}`)
      return
    }

    const senderName = service.name
    let instanceName: string | undefined

    if (this.options.instanceMappings) {
      const mapping = this.options.instanceMappings.find((mapping: any) => {
        return (
          service.name.startsWith(mapping.type) &&
          mapping.venusId == service.deviceInstance
        )
      })
      if (mapping !== undefined) {
        instanceName = mapping.signalkId
      }
    }

    if (instanceName === undefined) {
      if (
        this.options.useDeviceNames !== undefined &&
        this.options.useDeviceNames &&
        service.customName !== ''
      ) {
        instanceName = service.customName
      } else instanceName = service.deviceInstance
    }

    let entries

    if (m.member === 'ItemsChanged') {
      entries = m.body[0].map((item: any) => {
        return this.setValueAndText(item[1], { path: item[0] })
      })
    } else if (m.member === 'PropertiesChanged') {
      entries = [this.setValueAndText(m.body[0], { path: m.path })]
    }

    entries.forEach((msg: any) => {
      msg.instanceName = instanceName
      msg.senderName = senderName
    })

    entries.forEach(this.messageCallback)
  }

  setValue(destination: string, path: string, value: number) {
    this.app.debug(`setValue: ${destination} ${path} = ${value}`)
    this.bus.invoke(
      {
        path: path,
        destination: destination,
        interface: 'com.victronenergy.BusItem',
        member: 'SetValue',
        body: [
          // top level struct is js array
          ['n', value] // variant, type is number, value = 1
        ],
        signature: 'v'
      },
      (err: any, _res: any) => {
        if (err) {
          this.app.error(err)
        }
      }
    )
  }
}
