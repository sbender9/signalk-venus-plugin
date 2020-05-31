const PLUGIN_ID = 'venus'
const PLUGIN_NAME = 'Victron Venus Plugin'

const promiseRetry = require('promise-retry')
const _ = require('lodash')

const createDbusListener = require('./dbus-listener')
const venusToDeltas = require('./venusToDeltas')

const gpsDestination = 'com.victronenergy.gps'

module.exports = function (app) {
  const plugin = {}
  let onStop = []
  let dbusSetValue
  let pluginStarted = false
  let modesRegistered = []

  plugin.id = PLUGIN_ID
  plugin.name = PLUGIN_NAME
  plugin.description =
    'Plugin taking Battery, and other, from the D-Bus in Venus'

  plugin.schema = () => {
    return {
      title: PLUGIN_NAME,
      type: 'object',
      properties: {
        installType: {
          type: 'string',
          title: 'How to connect to Venus D-Bus',
          enum: ['local', 'remote'],
          enumNames: [
            'Connect to localhost (signalk-server is running on a Venus device)',
            'Connect to remote Venus installation'
          ],
          default: 'local'
        },
        dbusAddress: {
          type: 'string',
          title: 'Address for remote Venus device (D-Bus address notation)',
          default: 'tcp:host=192.168.1.57,port=78'
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
                  'com.victronenergy.solarcharger'
                ],
                enumNames: [
                  'Battery',
                  'Tank',
                  'Solar Charger'
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
          title: 'Blacklist',
          description: 'These paths will be ignored',
          type: 'array',
          items: {
            type: 'string',
            enum: plugin.getKnownPaths().sort()
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

    dbusSetValue('com.victronenergy.system',
                 `/Relay/${relay}/State`,
                 value ? 1 : 0)

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

    dbusSetValue(dest,
                 `/Mode`,
                 value)

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
    this.connect(options, toDelta)

    if ( app.registerActionHandler ) {
      [0, 1].forEach(relay => {
        let path =  (options['relayPath' + relay] || `electrical.switches.venus-${relay}`) + '.state'
        app.registerActionHandler('vessels.self',
                                  path,
                                  getActionHandler(relay))
      })
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
  }

  return plugin
}

function radsToDeg (radians) {
  return radians * 180 / Math.PI
}
