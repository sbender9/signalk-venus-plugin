const PLUGIN_ID = 'venus'
const PLUGIN_NAME = 'Victron Venus Plugin'

const promiseRetry = require('promise-retry')
const _ = require('lodash')
const mqtt = require('mqtt');
const createDbusListener = require('./dbus-listener')
const venusToDeltas = require('./venusToDeltas')

const gpsDestination = 'com.victronenergy.gps'

const supportedMQTTTypes = [ 'battery', 'solarcharger', 'tank', 'vebus', 'inverter', 'temperature' ]

module.exports = function (app) {
  const plugin = {}
  let onStop = []
  let dbusSetValue
  let pluginStarted = false
  let modesRegistered = []
  let relaysRegistered = []
  let keepAlive
  var fluidTypes = {}
  
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
          enum: ['local', 'remote', 'mqtt'],
          enumNames: [
            'Connect to localhost via dbus (signalk-server is running on a Venus device)',
            'Connect to remote Venus installation via dbus',
            'Connect to remote Venus installation via MQTT'
          ],
          default: 'local'
        },
        dbusAddress: {
          type: 'string',
          title: 'Address for remote Venus device (D-Bus address notation)',
          default: 'tcp:host=192.168.1.57,port=78'
        },
        MQTT: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              title: 'Venus MQTT URL',
              default: 'mqtt://venus.local:1883'
            }
          }
        },
        pollInterval: {
          type: 'number',
          title: 'Interval (in seconds) to poll venus for current values',
          default: 20
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
        /*
          relayDisplayName0: {
          type: 'string',
          title: 'The Display Name for relay 1',
          },
        */
        relayPath1: {
          type: 'string',
          title: 'The Signal K path for relay 2',
          default: 'electrical.switches.venus-1'
        },
        /*
          relayDisplayName1: {
          type: 'string',
          title: 'The Display Name for relay 2',
          },
        */
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
                type: 'number'
              },
              signalkId: {
                title: 'Signal K Instance',
                type: 'string'
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

  function handleMessage (delta) {
    app.handleMessage(PLUGIN_ID, delta)
  }

  function setValueCallback (msg) {
    dbusSetValue(msg.destination, msg.path, msg.value)
  }

  function actionHandler(context, path, value, relay, cb) {
    app.debug(`setting relay ${relay} to ${value}`)

    if ( plugin.options.installType === 'mqtt' ) {
      plugin.client.publish(relay, JSON.stringify({ value }))
    } else {
      dbusSetValue('com.victronenergy.system',
                   `/Relay/${relay}/State`,
                   value ? 1 : 0)
    }
    
    setTimeout(() => {
      var val = app.getSelfPath(path)
      if ( val && val.value == value ) {
        cb({ state: 'SUCCESS' })
      } else {
        cb({
          state: 'FAILURE',
          message: 'Did not receive change confirmation'
          })
      }
    }, 1000)
    
    return { state: 'PENDING' }
  }

  function getActionHandler(relay) {
    return (context, path, value, cb) => {
      return actionHandler(context, path, value, relay, cb)
    }
  }

  function chargerModeActionHandler(context, path, value, dest, cb) {
    app.debug(`setting charger mode ${dest} to ${value}`)

    if ( plugin.options.installType === 'mqtt' ) {
      plugin.client.publish(dest, JSON.stringify({ value }))
    } else {
      dbusSetValue(dest,
                   `/Mode`,
                   value)
      
    }

    setTimeout(() => {
      var val = app.getSelfPath(path)
      if ( val && val.value == value ) {
        cb({ state: 'SUCCESS' })
      } else {
        cb({
          state: 'FAILURE',
          message: 'Did not receive change confirmation'
        })
      }
    }, 1000)
    
    return { state: 'PENDING' }
  }

  function getChargerModeActionHandler(dest) {
    return (context, path, value, cb) => {
      return chargerModeActionHandler(context, path, value, dest, cb)
    }
  }

  /*
    Called when the plugin is started (server is started with plugin enabled
    or the plugin is enabled from ui on a running server).
  */
  plugin.start = function (options) {
    var { toDelta, getKnownPaths } = venusToDeltas(app, options, handleMessage)
    pluginStarted = true
    plugin.options = options
    plugin.onError = () => {}
    plugin.getKnownPaths = getKnownPaths
    
    if ( options.installType === 'mqtt' ) {
      startMQTT(options, toDelta)
    } else {
      if ( app.registerActionHandler ) {
        [0, 1].forEach(relay => {
          let path =  (options['relayPath' + relay] || `electrical.switches.venus-${relay}`) + '.state'
          app.registerActionHandler('vessels.self',
                                    path,
                                    getActionHandler(relay))
        })
      }
      
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

            venusMessages.forEach(m => {
              if ( m.senderName.startsWith('com.victronenergy.vebus')
                   && m.path === '/Mode'
                   && modesRegistered.indexOf(m.senderName) == -1 ) {
                const path = `electrical.chargers.${m.instanceName}.modeNumber`
                app.registerActionHandler('vessels.self',
                                          path,
                                          getChargerModeActionHandler(m.senderName))
                modesRegistered.push(m.senderName)
              }
            })
            
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
    modesRegistered = []

    if ( keepAlive ) {
      clearInterval(keepAlive)
      keepAlive = undefined
    }
  }

  function startMQTT(options, toDelta) {
    var url = options.MQTT.url
    var client = mqtt.connect(url)
    plugin.client = client

    plugin.needsID = true

    app.debug(`connecting to ${url}`)

    client.on('connect', function () {
      app.debug(`connected to ${url}`)
      client.subscribe('N/+/+/#')
      app.setProviderStatus(`Connected to ${url}`)

      //client.publish(`R/${portalID}/system/0/Serial`)

      //client.subscribe(`N/${portalID}/+/#`)
    })

    client.on('error', error => {
      app.error(`error connecting to mqtt ${error}`)
      app.setProviderError(`connecting to mqtt: ${error}`)
    })

    client.on('close', () => {
      app.debug(`mqtt close`)
    });

    client.on('reconnect', () => {
      app.debug(`mqtt reconnect`)
    });

    client.on('message', function (topic, json) {
      //app.debug(`${topic}: ${json}`)

      var parts = topic.split('/')
      var type = parts[2]
      var instance = parts[3]
      var fluidType

      var message = JSON.parse(json)
      
      if ( plugin.needsID ) {
        if ( topic.endsWith('system/0/Serial') ) {
          let portalID = message.value
          app.debug('detected portalId %s', portalID)
          client.publish(`R/${portalID}/system/0/Serial`)
          client.subscribe(`N/${portalID}/+/#`)
          plugin.needsID = false

          if ( keepAlive ) {
            clearInterval(keepAlive)
          }
          
          keepAlive = setInterval(function() {
            app.debug("send keep-alive")
            client.publish(`R/${portalID}/system/0/Serial`)
          }, 50*1000)
        }
        return
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
      }

      let senderName = `com.victronenergy.${type}.${instance}`
      if ( options.instanceMappings ) {
        const mapping = plugin.options.instanceMappings.find(mapping => {
          return senderName.startsWith(mapping.type) && mapping.venusId == instance
        })
        if ( !_.isUndefined(mapping) ) {
          instance = mapping.signalkId
        }
      }
      
      var m = {
        path: '/' + parts.slice(4).join('/'),
        instanceName: instance,
        senderName,
        value: message.value,
        fluidType: fluidType
      }

      //app.debug(JSON.stringify(m))

      if ( m.senderName.startsWith('com.victronenergy.vebus')
           && m.path === '/Mode'
           && modesRegistered.indexOf(m.senderName) === -1 ) {
        const path = `electrical.chargers.${m.instanceName}.modeNumber`
        const wtopic = 'W' + topic.slice(1)
        app.registerActionHandler('vessels.self',
                                  path,
                                  getChargerModeActionHandler(wtopic))
        modesRegistered.push(m.senderName)
      } else if ( m.senderName.startsWith('com.victronenergy.system')
                  && parts.length > 6
                  && parts[4] === 'Relay' && parts[6] === 'State'
                  && relaysRegistered.indexOf(topic) === -1 ) {
        const relay = parts[5]
        let path =  (options['relayPath' + relay] || `electrical.switches.venus-${relay}`) + '.state'
        const wtopic = 'W' + topic.slice(1)
        app.registerActionHandler('vessels.self',
                                  path,
                                  getActionHandler(wtopic))
        relaysRegistered.push(topic)
      }

      var deltas = toDelta([m])

      deltas.forEach(delta => {
        //app.debug(JSON.stringify(delta))
        app.handleMessage(PLUGIN_ID, delta)
      })
    })

    onStop.push(_ => client.end());
  }
  
  return plugin
}

function radsToDeg (radians) {
  return radians * 180 / Math.PI
}
