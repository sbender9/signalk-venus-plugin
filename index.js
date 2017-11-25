const PLUGIN_ID = 'vedirect'
const PLUGIN_NAME = 'VEDiret plugin'

const debug = require('debug')(PLUGIN_ID)

module.exports = function (app) {
  const plugin = {}

  plugin.id = PLUGIN_ID
  plugin.name = PLUGIN_NAME
  plugin.description = 'Plugin that does.....'

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

  /*
    Called when the plugin is started (server is started with plugin enabled 
    or the plugin is enabled from ui on a running server).
  */
  plugin.start = function (options) {}

  /*
    Called when the plugin is disabled on a running server with the plugin enabled.
  */
  plugin.stop = function () {
  }

  return plugin
}
