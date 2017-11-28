const PLUGIN_ID = 'venus'
const PLUGIN_NAME = 'Venus plugin'

const debug = require('debug')(PLUGIN_ID)

const createDbusListener = require('./dbus-listener')
const venusToDeltas = require('./venusToDeltas')

module.exports = function (app) {
  const plugin = {}

  plugin.id = PLUGIN_ID
  plugin.name = PLUGIN_NAME
  plugin.description = 'Plugin taking Battery, and other, from the D-Bus in Venus'

  plugin.schema = {
    title: PLUGIN_NAME,
    type: 'object',
    properties: {
      someParameter: {
        type: 'number',
        title: "Some configurable thing in SK servers' plugin config ui",
        default: 60
      }
    }
  }

  let stopDbus
  /*
    Called when the plugin is started (server is started with plugin enabled
    or the plugin is enabled from ui on a running server).
  */
  plugin.start = function (options) {
    try {
      stopDbus = createDbusListener(venusMessage => {
        venusToDeltas(venusMessage).forEach(delta => {
          app.handleMessage(PLUGIN_ID, delta)
        })
      })
    } catch ( error ) {
      console.error(`error creating dbus listener: ${error}`)
    }
  }

  /*
    Called when the plugin is disabled on a running server with the plugin enabled.
  */
  plugin.stop = function () {
    if (stopDbus) {
      dbusStop()
      stopDbus = undefined
    }
  }

  return plugin
}
