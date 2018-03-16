const PLUGIN_ID = 'venus'
const PLUGIN_NAME = 'Victron Venus Plugin'

const debug = require('debug')('signalk-venus-plugin')
const promiseRetry = require('promise-retry')

const createDbusListener = require('./dbus-listener')
const venusToDeltas = require('./venusToDeltas')

const gpsDestination = 'com.victronenergy.gps'

module.exports = function (app) {
  const plugin = {}
  let onStop = []
  let dbusSetValue
  let pluginStarted = false

  plugin.id = PLUGIN_ID
  plugin.name = PLUGIN_NAME
  plugin.description =
    'Plugin taking Battery, and other, from the D-Bus in Venus'

  plugin.schema = {
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
      } /*,
      sendPosistion: {
        type: 'boolean',
        title: 'Send Signal K position, course and speed to venus',
        default: false
      } */
    }
  }

  function handleMessage (delta) {
    app.handleMessage(PLUGIN_ID, delta)
  }

  function setValueCallback (msg) {
    dbusSetValue(msg.destination, msg.path, msg.value)
  }

  function actionHandler(context, path, value, relay, cb) {
    debug(`setting relay ${relay} to ${value}`)

    dbusSetValue('com.victronenergy.system',
                 `/Relay/${relay}/State`,
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

  /*
    Called when the plugin is started (server is started with plugin enabled
    or the plugin is enabled from ui on a running server).
  */
  plugin.start = function (options) {
    var { toDelta } = venusToDeltas(app, options, handleMessage)
    pluginStarted = true
    plugin.onError = () => {}
    this.connect(options, toDelta)

    if ( app.registerActionHandler ) {
      [0, 1].forEach(relay => {
        onStop.push(app.registerActionHandler('vessels.self',
                                              `electrical.switches.venus-${relay}.state`,
                                              relay,
                                              actionHandler))
      })
    }
  }

  plugin.connect = function(options, toDelta) {
    promiseRetry(
      (retry, number) => {
        if (!pluginStarted) {
          return null
        }
        debug(`Dbus connection attempt ${number}`)
        return createDbusListener(
          venusMessages => {
            toDelta(venusMessages).forEach(delta => {
              app.handleMessage(PLUGIN_ID, delta)
            })
          },
          options.installType == 'remote' ? options.dbusAddress : null,
          plugin
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
    debug('stop')
    pluginStarted = false
    onStop.forEach(f => f())
    onStop = []
  }

  return plugin
}

function radsToDeg (radians) {
  return radians * 180 / Math.PI
}
