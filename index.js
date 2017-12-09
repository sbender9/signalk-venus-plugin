const PLUGIN_ID = 'venus'
const PLUGIN_NAME = 'Venus plugin'

const debug = require('debug')(PLUGIN_ID)

const createDbusListener = require('./dbus-listener')
const venusToDeltas = require('./venusToDeltas')
const mqtt = require('mqtt');
const _ = require('lodash')

const supportedMQTTTypes = [ 'battery', 'solarcharger', 'tank', 'vebus' ]; // 'inverter', 'temperature' 

module.exports = function (app) {
  const plugin = {}
  var fluidTypes = {}
  var keepAlive
  var onStop = []
  
  plugin.id = PLUGIN_ID
  plugin.name = PLUGIN_NAME
  plugin.description = 'Plugin taking Battery, and other, from the D-Bus or MQTT in Venus'

  plugin.schema = {
    title: PLUGIN_NAME,
    type: 'object',
    properties: {
      sourceType: {
        type: "string",
        title: "Source For Venus Data",
        enum: [ "dbus", "mqtt" ],
        enumNames: [ "dbus", "MQTT"],
        default: "dbus"
      },

      MQTT: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            title: 'Venus MQTT URL',
            default: 'mqtt://beaglebone:1883'
          },
          portalID: {
            type: 'string',
            title: 'Venus VRM Portal ID',
          }
        }
      }
    }
  }

  let stopDbus
  /*
    Called when the plugin is started (server is started with plugin enabled
    or the plugin is enabled from ui on a running server).
  */
  plugin.start = function (options) {
    if ( _.isUndefined(options.sourceType) || options.sourceType == 'dbus' ) {
      try {
        stopDbus = createDbusListener(venusMessages => {
          venusToDeltas(venusMessages).forEach(delta => {
            app.handleMessage(PLUGIN_ID, delta)
          })
        })
      } catch ( error ) {
        console.error(`error creating dbus listener: ${error}`)
      }
    } else {
      startMQTT(options)
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

    onStop.forEach(f => f());
    onStop = []

    if ( keepAlive ) {
      clearInterval(keepAlive)
      keepAlive = undefined
    }
  }


  function startMQTT(options) {
    if ( !options.MQTT.portalID ) {
      console.log('error: no VRM PortalID configured"')
      return
    }

    var url = options.MQTT.url
    var client = mqtt.connect(url)
    var portalID = options.MQTT.portalID

    debug(`connecting to ${url}`)

    client.on('connect', function () {
      debug(`connected to ${url}`)
      //client.subscribe(`N/${portalID}/+/+/ProductId`)

      client.publish(`R/${portalID}/system/0/Serial`)
      
      supportedMQTTTypes.forEach(type => {
        client.subscribe(`N/${portalID}/${type}/#`)
      });


      if ( !keepAlive ) {
        keepAlive = setInterval(function() {
          debug("send keep-alive")
          client.publish(`R/${portalID}/system/0/Serial`)
        }, 50*1000)
      }
    })

    client.on('error', error => {
      console.log(`error connecting to mqtt ${error}`)
    })

    client.on('close', () => {
      console.log(`mqtt close`)
    });

    client.on('reconnect', () => {
      console.log(`mqtt reconnect`)
    });

    client.on('message', function (topic, json) {
      debug(`${topic}: ${json}`)

      var parts = topic.split('/')
      var type = parts[2]
      var instance = parts[3]
      var fluidType

      var message = JSON.parse(json)

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
      
      var m = {
        path: '/' + parts.slice(4).join('/'),
        instanceName: instance,
        senderName: 'com.victronenergy.' + type,
        value: message.value,
        fluidType: fluidType
      }

      //debug(JSON.stringify(m))

      var deltas = venusToDeltas([m])

      deltas.forEach(delta => {
        //debug(JSON.stringify(delta))
        app.handleMessage(PLUGIN_ID, delta)
      })
    })

    onStop.push(_ => client.end());
  }

  return plugin
}
