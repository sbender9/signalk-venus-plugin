const PLUGIN_ID = 'venus'
const PLUGIN_NAME = 'Victron Venus Plugin'

const camelcase = require('camelcase')
const promiseRetry = require('promise-retry')
const _ = require('lodash')
const mqtt = require('mqtt');
const createDbusListener = require('./dbus-listener')
const venusToDeltas = require('./venusToDeltas')
const vrmApiUrl = 'https://vrmapi.victronenergy.com'
const gpsDestination = 'com.victronenergy.gps'

const supportedMQTTTypes = [ 'battery', 'solarcharger', 'tank', 'vebus', 'inverter', 'temperature' ]

module.exports = function (app) {
  const plugin = {}
  let onStop = []
  let dbusSetValue
  let pluginStarted = false
  var fluidTypes = {}
  var temperatureTypes = {}
  var customNames = {}
  var customNameTimeouts = {}
  let sentDeltas = {}
  let pollInterval
  let keepAlive
  let seenMQTTTopics = []
  
  plugin.id = PLUGIN_ID
  plugin.name = PLUGIN_NAME
  plugin.description =
    'Plugin taking Battery, and other, from the D-Bus in Venus'

  plugin.schema = () => {
    let knowPaths
    if ( plugin.getKnownPaths ) {
      knowPaths = plugin.getKnownPaths().sort()
      if ( !knowPaths || knowPaths.length === 0 ) {
        knowPaths = [ 'no known paths yet' ]
      }
    } else {
      let options = app.readPluginOptions()
      knowPaths = options.configuration && options.configuration.blacklist ? options.configuration.blacklist : [ 'no known paths yet' ]
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
              title: 'Venus MQTT Password',
            }
          }
        },
        VRM: {
          type: 'object',
          properties: {
            portalId: {
              type: 'string',
              title: 'VRM Portal Id',
            },
            userName: {
              type: 'string',
              title: 'VRM Email',
            },
            password: {
              type: 'string',
              title: 'VRM Password',
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
          title: 'The Display Name for relay 1 (meta)',
        },
        relayPath1: {
          type: 'string',
          title: 'The Signal K path for relay 2',
          default: 'electrical.switches.venus-1'
        },
        relayDisplayName1: {
          type: 'string',
          title: 'The Display Name for relay 2 (meta)',
        },
        instanceMappings: {
          title: 'Instance Mappings',
          description: 'Map venus device instance numbers to Signal K instances',
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
                enumNames: [
                  'Battery',
                  'Tank',
                  'Solar Charger',
                  'VE.Bus'
                ],
              },
              
              venusId: {
                title: 'Venus Device Instance',
                description: '(Example: 257)',
                type: 'number'
              },
              signalkId: {
                title: 'Signal K Instance',
                type: 'string',
                description: '(Example: house)',
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

  
  function handleMessage (delta) {
    app.handleMessage(PLUGIN_ID, delta)
  }

  function setValueCallback (msg) {
    dbusSetValue(msg.destination, msg.path, msg.value)
  }

  function actionHandler(context, skpath, input, dest, vpath, mqttTopic, converter, confirmChange, putPath, cb) {
    let realPath = putPath ? putPath : vpath
    app.debug(`setting mode ${dest} ${realPath} to ${input}`)

    let value = converter ? converter(input) : input

    if ( value === undefined ) {
      return {
        state: 'FAILURE',
        message: `Invalid input value: ${input}`
      }
    }

    if ( plugin.options.installType === 'mqtt' ) {
      let wtopic
      if ( putPath ) {
        // N/985dadcb01dd/system/0/Dc/System/Power
        let parts = mqttTopic.split('/')
        wtopic = `W/${parts[1]}/${parts[2]}/${parts[3]}${putPath}`
      } else {
        wtopic = 'W' + mqttTopic.slice(1)
      }
      plugin.client.publish(wtopic, JSON.stringify({ value }))
    } else {
      dbusSetValue(dest, realPath, value)
    }

    setTimeout(() => {
      var val = app.getSelfPath(skpath)
      let match = false
      if ( confirmChange ) {
        match = val && confirmChange(val.value, value)
      } else if ( val && val.value == value ) {
        match = true
      }
      if ( match ) {
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

  function getActionHandler(m, converter, confirmChange, putPath) {
    return (context, path, value, cb) => {
      return actionHandler(context, path, value, m.senderName, m.path, m.topic, converter, confirmChange, putPath, cb)
    }
  }

  /*
    Called when the plugin is started (server is started with plugin enabled
    or the plugin is enabled from ui on a running server).
  */
  plugin.start = function (options) {
    var { toDelta, getKnownPaths, hasCustomName } =
        venusToDeltas(app, options, {},
                      (path, m, converter, confirmChange, putPath) => {
                        app.registerActionHandler('vessels.self',
                                                  path,
                                                  getActionHandler(m,converter,
                                                                   confirmChange,
                                                                   putPath))
                      })
    
    pluginStarted = true
    plugin.options = options
    plugin.onError = () => {}
    plugin.getKnownPaths = getKnownPaths
    plugin.hasCustomName = hasCustomName

    if ( options.relayDisplayName0 && options.relayDisplayName0.length ) {
      sendMeta(options.relayPath0, { displayName: options.relayDisplayName0 })
      sendMeta(options.relayPath0 + ".state", { displayName: options.relayDisplayName0 })
    }
    if ( options.relayDisplayName1 && options.relayDisplayName1.length ) {
      sendMeta(options.relayPath1, { displayName: options.relayDisplayName1 })
      sendMeta(options.relayPath1 + ".state", { displayName: options.relayDisplayName1 })
    }
    
    if ( options.installType === 'mqtt' || options.installType === 'mqtts' || options.installType === 'vrm' ) {
      startMQTT(options, toDelta)
    } else {
      this.connect(options, toDelta)
    }
  }

  plugin.connect = function(options, toDelta) {
    promiseRetry(
      (retry, number) => {
        if (!pluginStarted) {
          return null
        }
        app.debug(`Dbus connection attempt ${number}`)
        return createDbusListener(
          app,
          venusMessages => {
            toDelta(venusMessages).forEach(delta => {
              app.handleMessage(PLUGIN_ID, delta)
            })
          },
          options.installType == 'remote' ? options.dbusAddress : null,
          plugin,
          _.isUndefined(options.pollInterval) ? 20 : options.pollInterval
        ).catch(retry)
      },
      {
        maxTimeout: 30 * 1000,
        forever: true
      }
    )
      .then(dbus => {
        if (dbus && pluginStarted) {
          plugin.onError = () => {
            app.removeListener('venusSetValue', setValueCallback)
            dbus.onStop()
            onStop = []
            plugin.onError = () => {}
            plugin.connect(options, toDelta)
          }
          dbusSetValue = dbus.setValue
          onStop.push(dbus.onStop)
          app.on('venusSetValue', setValueCallback)
          onStop.push(() =>
            app.removeListener('venusSetValue', setValueCallback)
          )
        }
      })
      .catch(error => {
        console.error(`error creating dbus listener: ${error}`)
      })
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
    pluginStarted = false
    onStop.forEach(f => f())
    onStop = []
    sentDeltas = {}
    seenMQTTTopics = []
    customNames = {}
    customNameTimeouts = {}
    plugin.needsID = true
    plugin.portalID = null
    if ( pollInterval ) {
      clearInterval(pollInterval)
      pollInterval = null
    }
    if ( keepAlive ) {
      clearInterval(keepAlive)
      keepAlive = null
    }
  }


  function getVRMBrokerHost(portalId) {
    let sum = 0;
    
    for ( let idx = 0; idx < portalId.length; idx++ ) {
      let c = portalId.charCodeAt(idx)
      sum += c;
    }
    let broker_index = sum % 128;
    return `mqtt${broker_index}.victronenergy.com`
  }

  function setupSubscription(options, client) {
    client.publish(`R/${plugin.portalID}/system/0/Serial`)
    client.subscribe(`N/${plugin.portalID}/+/#`)
    if ( options.pollInterval !== -1 ) {
      if ( pollInterval ) {
        clearInterval(pollInterval)
      }
      pollInterval = setInterval(() => {
        app.debug('resending deltas...')
        resendDeltas()
      }, options.pollInterval*1000)
      if ( keepAlive ) {
        clearInterval(keepAlive)
      }
      keepAlive = setInterval(() => {
        app.debug('sending keep alive')
        client.publish(`R/${plugin.portalID}/system/0/Serial`)
        client.subscribe(`N/${plugin.portalID}/+/#`)
      }, 50*1000)
    }
  }

  function startMQTT(options, toDelta) {
    var host
    var port
    var scheme
    var username
    var password
    const isVRM = options.installType === 'vrm'
    
    if ( isVRM ) {
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

      if ( !host || !host.length ) {
        app.setPluginError('no host configured')
        return
      }
    }

    const url = `${scheme}://${host}:${port}`

    app.debug('using mqtt url %s', url)

    let connectOptions = {
      rejectUnauthorized: false,
    }

    if ( password && password.length )
    {
      connectOptions.username = username
      connectOptions.password = password
    }
    
    var client = mqtt.connect(url, connectOptions)
    plugin.client = client

    if ( isVRM ) {
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

      if ( isVRM ) {
        setupSubscription(options, client)
      } else {
        client.subscribe('N/+/+/#')
      }


      //client.publish(`R/${portalID}/system/0/Serial`)

      //client.subscribe(`N/${portalID}/+/#`)
    })

    client.on('error', error => {
      app.error(`error connecting to mqtt ${error}`)
      app.setPluginError(`connecting to mqtt: ${error}`)
    })

    client.on('close', () => {
      sentDeltas = {}
      customNames = {}
      customNameTimeouts = {}
      if ( isVRM === false ) {
        plugin.needsID = true
        plugin.portalID = null
      }
      app.debug(`mqtt close`)
    });

    client.on('reconnect', () => {
      app.debug(`mqtt reconnect`)
    });

    client.on('message', function (topic, json) {
      if ( json.length === 0 ) {
        app.debug('offline: %s', topic)
        const info = sentDeltas[topic]
        if ( info ) {
          info.deltas.forEach(delta => {
            if ( delta.updates ) {
              delta.updates.forEach(update => {
                if ( update.values ) {
                  update.values.forEach(val => {
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

      var parts = topic.split('/')
      var type = parts[2]
      var instance = parts[3]
      var fluidType
      var temperatureType

      var message

      try {
        message = JSON.parse(json)
      } catch ( err ) {
        app.debug(err)
        return
      }

      //app.debug(topic)
      
      if ( plugin.needsID ) {
        if ( topic.endsWith('system/0/Serial') ) {
          if ( !isVRM ) {
            plugin.portalID = message.value
            app.debug('detected portalId %s', plugin.portalID)
          }
          plugin.needsID = false
          setupSubscription(options, client)
        }

        if ( !isVRM ) {
          return
        }
      }

      if ( seenMQTTTopics.indexOf(topic) == -1 ) {
        app.debug(`found ${topic} = ${message.value}`)
        seenMQTTTopics.push(topic)
      }

      let senderName = `com.victronenergy.${type}.${instance}`
      
      if ( plugin.options.useDeviceNames !== undefined &&
           plugin.options.useDeviceNames ) {
        if ( customNames[senderName] === undefined &&
             plugin.hasCustomName(`com.victronenergy.${type}`) ) {
          if ( parts[parts.length-1] === 'CustomName' ) {
            app.debug('got CustomName "%s" for %s', message.value, senderName)
            customNames[senderName] = camelcase(message.value)
          } else {
            let timeout = customNameTimeouts[senderName]
            if ( timeout === undefined ) {
              customNameTimeouts[senderName] = Date.now()
              return
            } else if ( Date.now() - timeout > 10 * 1000 ) {
              customNames[senderName] = instance
              app.debug('timed out waiting on CustomName for %s', senderName)
            } else {
              return
            }
          }
        }
      }
      
      if ( type == 'tank' ) {
        if ( parts[parts.length-1] == 'FluidType' ) {
          fluidTypes[instance] = message.value
          return
        }
        fluidType = fluidTypes[instance]
        if ( fluidType == 'unknown' ) {
          return
        } else if ( _.isUndefined(fluidType) ) {
          client.publish(`R/${parts[1]}/${type}/${instance}/FluidType`)
          client.publish(`R/${parts[1]}/${type}/${instance}/Capacity`)
          fluidTypes[instance] = 'unknown'
          return
        }
      } else if ( type === 'temperature' ) {
        if ( parts[parts.length-1] == 'TemperatureType' ) {
          temperatureTypes[instance] = message.value
          return
        }
        temperatureType = temperatureTypes[instance]
        if ( temperatureType == 'unknown' ) {
          return
 } else if ( _.isUndefined(temperatureType) ) {
          client.publish(`R/${parts[1]}/${type}/${instance}/TemperatureType`)
          temperatureTypes[instance] = 'unknown'
          return
        }
      }

      let instanceName
      if ( options.instanceMappings ) {
        const mapping = plugin.options.instanceMappings.find(mapping => {
          return senderName.startsWith(mapping.type) && mapping.venusId == instance
        })
        if ( !_.isUndefined(mapping) ) {
          instanceName = mapping.signalkId
        }
      }

      if ( instanceName === undefined )
      {
        if ( plugin.options.useDeviceNames !== undefined &&
             plugin.options.useDeviceNames &&
             customNames[senderName] !== undefined &&
             customNames[senderName] !== '' ) {
          instanceName = customNames[senderName]
        }
        else
          instanceName = instance
      }
      
      var m = {
        path: '/' + parts.slice(4).join('/'),
        instanceName: instanceName,
        senderName,
        value: message.value,
        fluidType: fluidType,
        topic,
        temperatureType
      }

      //app.debug(JSON.stringify(m))

      var deltas = toDelta([m])

      if ( deltas.length ) {
        let anyUpdates = (deltas) => deltas.find(delta => delta.updates.find(update => update.values && update.values.length > 0))

        if ( anyUpdates(deltas) ) {
          sentDeltas[topic] = {
            deltas: JSON.parse(JSON.stringify(deltas)),
            time: Date.now(),
            topic
          }
        
          deltas.forEach(delta => {
            app.handleMessage(PLUGIN_ID, delta)
          })
        }
      }
    })

    onStop.push(_ => client.end());
  }

  function resendDeltas() {
    const now = Date.now()
    Object.values(sentDeltas).forEach((info) => {
      if ( now - info.time > ((plugin.options.pollInterval-1)*1000) ) {
        //app.debug('resending %s', info.topic)
        //app.debug('%j', info.delta)
        info.deltas.forEach((delta) => {
          if ( delta.updates[0].values && delta.updates[0].values.length > 0 &&
               !delta.updates[0].values[0].path.startsWith('notifications.') ) {
              app.handleMessage(PLUGIN_ID, JSON.parse(JSON.stringify(delta)))
          }
        })
      }
    })
  }

  function sendMeta(path, value) {
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

function radsToDeg (radians) {
  return radians * 180 / Math.PI
}
