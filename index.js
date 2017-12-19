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
      installType : {
        type: 'string',
        title: 'How to connect to Venus D-Bus',
        enum: [ 'local', 'remote' ],
        enumNames: [
          'Connect to localhost (signalk-server is running on a Venus device)',
          'Connect to remote Venus installation'],
        default: 'local'
      },
      dbusAddress: {
        type: 'string',
        title: 'Address for remote Venus device (D-Bus address notation)' ,
        default: 'tcp:host=192.168.1.57,port=78'
      }
    }
  }

  /*
    Called when the plugin is started (server is started with plugin enabled
    or the plugin is enabled from ui on a running server).
  */
  plugin.start = function (options) {
    try {
      dbusStop = createDbusListener(venusMessages => {
        venusToDeltas(venusMessages).forEach(delta => {
          app.handleMessage(PLUGIN_ID, delta)
        })
      }, options.installType == 'remote' ? options.dbusAddress : '')
    } catch ( error ) {
      console.error(`error creating dbus listener: ${error}`)
    }
  }

  /*
    Called when the plugin is disabled on a running server with the plugin enabled.
  */
  plugin.stop = function () {
    if (typeof dbusStop !== 'undefined') {
      dbusStop()
      dbusStop = undefined
    }
  }

  return plugin
}
