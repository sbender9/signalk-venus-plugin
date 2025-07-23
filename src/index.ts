/* eslint-disable @typescript-eslint/no-explicit-any */

//import { ServerAPI, Plugin, Delta, Update, PathValue, SourceRef, Path, hasValues} from '@signalk/server-api'
import camelcase from 'camelcase'
import mqtt, { MqttClient } from 'mqtt'
import { DbusListener } from './dbus-listener'
import { VenusToSignalK } from './venusToDeltas'
import { Message } from './venusToDeltas'

const PLUGIN_ID = 'venus'
const PLUGIN_NAME = 'Victron Venus Plugin'

module.exports = function (app: any) {
  const plugin: any = {}
  let onStop: any[] = []
  //let dbusSetValue: any
  const fluidTypes: { [key: string]: number | null } = {}
  const temperatureTypes: { [key: string]: number | null } = {}
  let customNames: { [key: string]: string } = {}
  let customNameTimeouts: { [key: string]: number } = {}
  let sentDeltas: { [key: string]: any } = {}
  let pollInterval: NodeJS.Timeout | null = null
  let keepAlive: NodeJS.Timeout | null = null
  let seenMQTTTopics: string[] = []
  let venusToSignalK: VenusToSignalK | undefined
  let dbusListener: DbusListener | undefined

  plugin.id = PLUGIN_ID
  plugin.name = PLUGIN_NAME
  plugin.description =
    'Plugin taking Battery, and other, from the D-Bus in Venus'

  plugin.schema = () => {
    let knowPaths
    let knownSenders = ['no known senders yet']
    if (venusToSignalK) {
      const ks = venusToSignalK.getKnownSenders()
      if (ks && ks.length > 0) {
        knownSenders = ks
      }
    }
    if (venusToSignalK) {
      knowPaths = venusToSignalK.getKnownPaths().sort()
      if (!knowPaths || knowPaths.length === 0) {
        knowPaths = ['no known paths yet']
      }
    } else {
      const options = app.readPluginOptions() as any
      knowPaths =
        options.configuration && options.configuration.blacklist
          ? options.configuration.blacklist
          : ['no known paths yet']
    }
    return {
      title: PLUGIN_NAME,
      type: 'object',
      properties: {
        installType: {
          type: 'string',
          title: 'How to connect to Venus D-Bus',
          enum: ['mqtt', 'mqtts', 'local', 'remote', 'vrm'],
          enumNames: [
            'Connect to remote Venus installation via MQTT (Plain text)',
            'Connect to remote Venus installation via MQTT (SSL)',
            'Connect to localhost via dbus (signalk-server is running on a Venus device)',
            'Connect to remote Venus installation via dbus',
            'Connect to remote Venus installation via VRM'
          ],
          default: 'mqtt'
        },
        dbusAddress: {
          type: 'string',
          title: 'Address for remote Venus device (D-Bus address notation)',
          default: 'tcp:host=192.168.1.57,port=78'
        },
        MQTT: {
          type: 'object',
          properties: {
            host: {
              type: 'string',
              title: 'Venus MQTT Host',
              default: 'venus.local'
            },
            password: {
              type: 'string',
              title: 'Venus MQTT Password'
            }
          }
        },
        VRM: {
          type: 'object',
          properties: {
            portalId: {
              type: 'string',
              title: 'VRM Portal Id'
            },
            userName: {
              type: 'string',
              title: 'VRM Email'
            },
            password: {
              type: 'string',
              title: 'VRM Password'
            }
          }
        },
        pollInterval: {
          type: 'number',
          title: 'Interval (in seconds) to poll venus for current values',
          default: 20
        },
        useDeviceNames: {
          type: 'boolean',
          title: 'Use the device names for paths',
          default: false
        },
        usePosition: {
          type: 'boolean',
          title: 'Use the position from Venus OS',
          default: true
        },
        relayPath0: {
          type: 'string',
          title: 'The Signal K path for relay 1',
          default: 'electrical.switches.venus-0'
        },
        relayDisplayName0: {
          type: 'string',
          title: 'The Display Name for relay 1 (meta)'
        },
        relayPath1: {
          type: 'string',
          title: 'The Signal K path for relay 2',
          default: 'electrical.switches.venus-1'
        },
        relayDisplayName1: {
          type: 'string',
          title: 'The Display Name for relay 2 (meta)'
        },
        instanceMappings: {
          title: 'Instance Mappings',
          description:
            'Map venus device instance numbers to Signal K instances',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                enum: [
                  'com.victronenergy.battery',
                  'com.victronenergy.tank',
                  'com.victronenergy.solarcharger',
                  'com.victronenergy.vebus'
                ],
                enumNames: ['Battery', 'Tank', 'Solar Charger', 'VE.Bus']
              },

              venusId: {
                title: 'Venus Device Instance',
                description: '(Example: 257)',
                type: 'number'
              },
              signalkId: {
                title: 'Signal K Instance',
                type: 'string',
                description: '(Example: house)'
              }
            }
          }
        },
        temperatureMappings: {
          title: 'Temperature Mappings',
          description: 'Map temperature inputs to Signal K paths',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              venusId: {
                title: 'Venus Device Instance',
                type: 'number',
                default: 23
              },
              signalkPath: {
                title: 'Signal K Path',
                type: 'string',
                default: 'environment.inside.refrigerator.temperature'
              }
            }
          }
        },
        blacklist: {
          title: 'Block List',
          description: 'These paths will be ignored',
          type: 'array',
          items: {
            type: 'string',
            enum: knowPaths
          }
        },
        ignoredSenders: {
          title: 'Ingored Senders',
          description: 'These senders will be ignored',
          type: 'array',
          items: {
            type: 'string',
            enum: knownSenders
          }
        }
        /*,
          sendPosistion: {
          type: 'boolean',
          title: 'Send Signal K position, course and speed to venus',
          default: false
          } */
      }
    }
  }

  plugin.uiSchema = () => {
    return {
      MQTT: {
        password: {
          'ui:widget': 'password'
        }
      },
      VRM: {
        password: {
          'ui:widget': 'password'
        }
      }
    }
  }

  /*
  function setValueCallback(msg: any) {
    dbusSetValue(msg.destination, msg.path, msg.value)
  }
    */

  function actionHandler(
    context: string,
    skpath: string,
    input: any,
    dest: string,
    vpath: string,
    mqttTopic: string | undefined,
    converter: (input: any) => any,
    confirmChange: (oldValue: any, newValue: any) => boolean,
    putPath: string,
    cb: (result: any) => void
  ) {
    const realPath = putPath ? putPath : vpath
    app.debug(`setting mode ${dest} ${realPath} to ${input}`)

    const value = converter ? converter(input) : input

    if (value === undefined) {
      return {
        state: 'FAILURE',
        message: `Invalid input value: ${input}`
      }
    }

    if (plugin.options.installType === 'mqtt') {
      let wtopic
      if (putPath) {
        // N/985dadcb01dd/system/0/Dc/System/Power
        const parts = mqttTopic!.split('/')
        wtopic = `W/${parts[1]}/${parts[2]}/${parts[3]}${putPath}`
      } else {
        wtopic = 'W' + mqttTopic!.slice(1)
      }
      plugin.client.publish(wtopic, JSON.stringify({ value }))
    } else {
      dbusListener!.setValue(dest, realPath, value)
    }

    setTimeout(() => {
      const val = app.getSelfPath(skpath)
      let match = false
      if (confirmChange) {
        match = val && confirmChange(val.value, value)
      } else if (val && val.value == value) {
        match = true
      }
      if (match) {
        cb({ state: 'SUCCESS' })
      } else {
        cb({
          state: 'FAILURE',
          message: 'Did not receive change confirmation'
        })
      }
    }, 2000)

    return { state: 'PENDING' }
  }

  function getActionHandler(
    m: Message,
    converter: (input: any) => any,
    confirmChange: (oldValue: any, newValue: any) => boolean,
    putPath: string
  ) {
    return (
      context: string,
      path: string,
      value: any,
      cb: (result: any) => void
    ) => {
      return actionHandler(
        context,
        path,
        value,
        m.senderName,
        m.path,
        m.topic,
        converter,
        confirmChange,
        putPath,
        cb
      )
    }
  }

  /*
    Called when the plugin is started (server is started with plugin enabled
    or the plugin is enabled from ui on a running server).
  */
  plugin.start = function (options: any) {
    venusToSignalK = new VenusToSignalK(
      app,
      options,
      {},
      (
        path: string,
        m: Message,
        converter: (input: any) => any,
        confirmChange: (oldValue: any, newValue: any) => boolean,
        putPath: string
      ) => {
        app.registerActionHandler(
          'vessels.self',
          path,
          getActionHandler(m, converter, confirmChange, putPath)
        )
      }
    )

    plugin.options = options
    plugin.onError = () => {}

    if (options.relayDisplayName0 && options.relayDisplayName0.length) {
      sendMeta(options.relayPath0, { displayName: options.relayDisplayName0 })
      sendMeta(options.relayPath0 + '.state', {
        displayName: options.relayDisplayName0
      })
    }
    if (options.relayDisplayName1 && options.relayDisplayName1.length) {
      sendMeta(options.relayPath1, { displayName: options.relayDisplayName1 })
      sendMeta(options.relayPath1 + '.state', {
        displayName: options.relayDisplayName1
      })
    }

    if (
      options.installType === 'mqtt' ||
      options.installType === 'mqtts' ||
      options.installType === 'vrm'
    ) {
      startMQTT(options, venusToSignalK.toDelta.bind(venusToSignalK))
    } else {
      this.connect(options, venusToSignalK.toDelta.bind(venusToSignalK))
    }
  }

  plugin.connect = function (options: any, toDelta: any) {
    dbusListener = new DbusListener(
      app,
      (venusMessage: Message) => {
        toDelta(venusMessage).forEach((delta: any) => {
          app.handleMessage(PLUGIN_ID, delta)
        })
      },
      options.installType == 'remote' ? options.dbusAddress : null,
      plugin,
      options.pollInterval === undefined ? 20 : options.pollInterval
    )

    onStop.push(dbusListener.stop.bind(dbusListener))
    /*
    app.on('venusSetValue', setValueCallback)
    onStop.push(() =>
      app.removeListener('venusSetValue', setValueCallback)
    )*/
  }

  /*
  function handleDelta(delta) {
    if ( delta.updates ) {
      delta.updates.forEach(update => {
        if ( typeof update.source !== 'undefined'
             && typeof update.source.label !== 'undefined'
             && update.source.label === "venus") {
          //don't reset data we got from venus
          return
        }
        update.values.forEach((valuePath) => {
          if ( valuePath.path === 'navigation.speedOverGround' ) {
            dbusSetValue(gpsDestination, '/Speed', Math.round(valuePath.value * 100))

          } else if ( valuePath.path === 'navigation.courseOverGroundTrue' ) {
            dbusSetValue(gpsDestination, '/Course', Math.round(radsToDeg(valuePath.value)))
          } else if ( valuePath.path === 'navigation.position' ) {
            dbusSetValue(gpsDestination, '/Location/Latitude', Math.round(valuePath.value.latitude*100000))
            dbusSetValue(gpsDestination, '/Location/Longitude', Math.round(valuePath.value.longitude*10000))
          }
        })
      })
    }
  }
*/

  /*
    Called when the plugin is disabled on a running server with the plugin enabled.
  */
  plugin.stop = function () {
    app.debug('stop')
    onStop.forEach((f) => f())
    onStop = []
    sentDeltas = {}
    seenMQTTTopics = []
    customNames = {}
    customNameTimeouts = {}
    dbusListener = undefined
    plugin.needsID = true
    plugin.portalID = null
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
    if (keepAlive) {
      clearInterval(keepAlive)
      keepAlive = null
    }
  }

  function getVRMBrokerHost(portalId: string) {
    let sum = 0

    for (let idx = 0; idx < portalId.length; idx++) {
      const c = portalId.charCodeAt(idx)
      sum += c
    }
    const broker_index = sum % 128
    return `mqtt${broker_index}.victronenergy.com`
  }

  function setupSubscription(options: any, client: MqttClient) {
    client.publish(`R/${plugin.portalID}/system/0/Serial`, '')
    client.subscribe(`N/${plugin.portalID}/+/#`)
    if (options.pollInterval !== -1) {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
      pollInterval = setInterval(() => {
        app.debug('resending deltas...')
        resendDeltas()
      }, options.pollInterval * 1000)
      if (keepAlive) {
        clearInterval(keepAlive)
      }
      keepAlive = setInterval(() => {
        app.debug('sending keep alive')
        client.publish(`R/${plugin.portalID}/system/0/Serial`, '')
        client.subscribe(`N/${plugin.portalID}/+/#`)
      }, 50 * 1000)
    }
  }

  function startMQTT(options: any, toDelta: any) {
    let host
    let port
    let scheme
    let username
    let password
    const isVRM = options.installType === 'vrm'

    if (isVRM) {
      host = getVRMBrokerHost(options.VRM.portalId)
      port = 8883
      scheme = 'mqtts'
      username = options.VRM.userName
      password = options.VRM.password
    } else {
      host = options.MQTT.host
      port = options.installType === 'mqtt' ? 1883 : 8883
      scheme = options.installType
      password = options.MQTT.password
      username = ''

      if (!host || !host.length) {
        app.setPluginError('no host configured')
        return
      }
    }

    const url = `${scheme}://${host}:${port}`

    app.debug('using mqtt url %s', url)

    const connectOptions: any = {
      rejectUnauthorized: false
    }

    if (password && password.length) {
      connectOptions.username = username
      connectOptions.password = password
    }

    const client = mqtt.connect(url, connectOptions)
    plugin.client = client

    if (isVRM) {
      plugin.portalID = options.VRM.portalId
      plugin.needsID = false
    } else {
      plugin.needsID = true
      plugin.portalID = null
    }

    app.debug(`connecting to ${url}`)

    client.on('connect', function () {
      app.debug(`connected to ${url}`)
      app.setPluginStatus(`Connected to ${url}`)

      if (isVRM) {
        setupSubscription(options, client)
      } else {
        client.subscribe('N/+/+/#')
      }

      //client.publish(`R/${portalID}/system/0/Serial`)

      //client.subscribe(`N/${portalID}/+/#`)
    })

    client.on('error', (error) => {
      app.error(`error connecting to mqtt ${error}`)
      app.setPluginError(`connecting to mqtt: ${error}`)
    })

    client.on('close', () => {
      sentDeltas = {}
      customNames = {}
      customNameTimeouts = {}
      if (isVRM === false) {
        plugin.needsID = true
        plugin.portalID = null
      }
      app.debug(`mqtt close`)
    })

    client.on('reconnect', () => {
      app.debug(`mqtt reconnect`)
    })

    client.on('message', function (topic, json) {
      if (json.length === 0) {
        app.debug('offline: %s', topic)
        const info = sentDeltas[topic]
        if (info) {
          info.deltas.forEach((delta: any) => {
            if (delta.updates) {
              delta.updates.forEach((update: any) => {
                if (update.values) {
                  update.values.forEach((val: any) => {
                    val.value = null
                  })
                }
              })
              app.handleMessage(PLUGIN_ID, delta)
            }
          })
          delete sentDeltas[topic]
        }
        return
      }

      const parts = topic.split('/')
      const type = parts[2]
      const instance = parts[3]
      let fluidType
      let temperatureType

      let message

      try {
        message = JSON.parse(json.toString())
      } catch (err) {
        app.debug(err)
        return
      }

      //app.debug(topic)

      if (plugin.needsID) {
        if (topic.endsWith('system/0/Serial')) {
          if (!isVRM) {
            plugin.portalID = message.value
            app.debug('detected portalId %s', plugin.portalID)
          }
          plugin.needsID = false
          setupSubscription(options, client)
        }

        if (!isVRM) {
          return
        }
      }

      if (seenMQTTTopics.indexOf(topic) == -1) {
        app.debug(`found ${topic} = ${message.value}`)
        seenMQTTTopics.push(topic)
      }

      const senderName = `com.victronenergy.${type}.${instance}`

      if (
        plugin.options.useDeviceNames !== undefined &&
        plugin.options.useDeviceNames
      ) {
        if (
          customNames[senderName] === undefined &&
          venusToSignalK !== undefined &&
          venusToSignalK.hasCustomName(`com.victronenergy.${type}`)
        ) {
          if (parts[parts.length - 1] === 'CustomName') {
            app.debug('got CustomName "%s" for %s', message.value, senderName)
            customNames[senderName] = camelcase(message.value)
          } else {
            const timeout = customNameTimeouts[senderName]
            if (timeout === undefined) {
              customNameTimeouts[senderName] = Date.now()
              return
            } else if (Date.now() - timeout > 10 * 1000) {
              customNames[senderName] = instance
              app.debug('timed out waiting on CustomName for %s', senderName)
            } else {
              return
            }
          }
        }
      }

      if (type == 'tank') {
        if (parts[parts.length - 1] == 'FluidType') {
          fluidTypes[instance] = message.value
          return
        }
        fluidType = fluidTypes[instance]
        if (fluidType == null) {
          return
        } else if (fluidType === undefined) {
          client.publish(`R/${parts[1]}/${type}/${instance}/FluidType`, '')
          client.publish(`R/${parts[1]}/${type}/${instance}/Capacity`, '')
          fluidTypes[instance] = null
          return
        }
      } else if (type === 'temperature') {
        if (parts[parts.length - 1] == 'TemperatureType') {
          temperatureTypes[instance] = message.value
          return
        }
        temperatureType = temperatureTypes[instance]
        if (temperatureType == null) {
          return
        } else if (temperatureType === undefined) {
          client.publish(
            `R/${parts[1]}/${type}/${instance}/TemperatureType`,
            ''
          )
          temperatureTypes[instance] = null
          return
        }
      }

      let instanceName
      if (options.instanceMappings) {
        const mapping = plugin.options.instanceMappings.find((mapping: any) => {
          return (
            senderName.startsWith(mapping.type) && mapping.venusId == instance
          )
        })
        if (mapping !== undefined) {
          instanceName = mapping.signalkId
        }
      }

      if (instanceName === undefined) {
        if (
          plugin.options.useDeviceNames !== undefined &&
          plugin.options.useDeviceNames &&
          customNames[senderName] !== undefined &&
          customNames[senderName] !== ''
        ) {
          instanceName = customNames[senderName]
        } else instanceName = instance
      }

      const m: Message = {
        path: '/' + parts.slice(4).join('/'),
        instanceName: instanceName,
        senderName,
        value: message.value,
        fluidType: fluidType,
        topic,
        temperatureType
      }

      //app.debug(JSON.stringify(m))

      const deltas = toDelta(m)

      if (deltas.length) {
        const anyUpdates = (deltas: any[]) =>
          deltas.find((delta) =>
            delta.updates.find(
              (update: any) => update.values && update.values.length > 0
            )
          )

        if (anyUpdates(deltas)) {
          sentDeltas[topic] = {
            deltas: JSON.parse(JSON.stringify(deltas)),
            time: Date.now(),
            topic
          }

          deltas.forEach((delta: any) => {
            app.handleMessage(PLUGIN_ID, delta)
          })
        }
      }
    })

    onStop.push((_: any) => client.end())
  }

  function resendDeltas() {
    const now = Date.now()
    Object.values(sentDeltas).forEach((info) => {
      if (now - info.time > (plugin.options.pollInterval - 1) * 1000) {
        //app.debug('resending %s', info.topic)
        //app.debug('%j', info.delta)
        info.deltas.forEach((delta: any) => {
          if (
            delta.updates[0].values &&
            delta.updates[0].values.length > 0 &&
            !delta.updates[0].values[0].path.startsWith('notifications.')
          ) {
            app.handleMessage(PLUGIN_ID, JSON.parse(JSON.stringify(delta)))
          }
        })
      }
    })
  }

  function sendMeta(path: string, value: any) {
    app.handleMessage(PLUGIN_ID, {
      updates: [
        {
          meta: [
            {
              path,
              value
            }
          ]
        }
      ]
    })
  }
  return plugin
}
