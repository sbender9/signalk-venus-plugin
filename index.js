const PLUGIN_ID = 'venus'
const PLUGIN_NAME = 'Victron Venus Plugin'

const createDbusListener = require('./dbus-listener')
const venusToDeltas = require('./venusToDeltas')

const gpsDestination = 'com.victronenergy.gps'

module.exports = function (app) {
  const plugin = {}
  var onStop = []
  var dbusSetValue

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

  /*
    Called when the plugin is started (server is started with plugin enabled
    or the plugin is enabled from ui on a running server).
  */
  plugin.start = function (options) {
    var { toDelta } = venusToDeltas(app, options, handleMessage)

    try {
      var dbus = createDbusListener(
        venusMessages => {
          toDelta(venusMessages).forEach(delta => {
            app.handleMessage(PLUGIN_ID, delta)
          })
        },
        options.installType == 'remote' ? options.dbusAddress : null,
        onStop
      )

      dbusSetValue = dbus.setValue
      app.on('venusSetValue', setValueCallback)

    } catch (error) {
      console.error(error.stack)
      console.error(`error creating dbus listener: ${error}`)
    }
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
    onStop.forEach(f => f())
    onStop = []

    app.removeListener('venusSetValue', setValueCallback)
  }

  return plugin
}

function radsToDeg (radians) {
  return radians * 180 / Math.PI
}
