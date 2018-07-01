const { isArray, isFunction, isUndefined, values, forIn } = require('lodash')
const debug = require('debug')('signalk-venus-plugin:venusToDeltas')
const _ = require('lodash')

var lastLat, lastLon

const venusToSignalKMapping = {
  '/Dc/0/Voltage': {
    path: m => {
      return makePath(m, `${m.instanceName}.voltage`)
    }
  },
  '/Dc/1/Voltage': {
    path: m => {
      return makePath(m, `${m.instanceName}-second.voltage`)
    }
  },
  '/Dc/0/Current': {
    path: m => {
      return makePath(m, `${m.instanceName}.current`)
    }
  },
  '/Dc/0/Power': {
    path: m => {
      return makePath(m, `${m.instanceName}.power`)
    }
  },
  '/Dc/0/Temperature': {
    path: m => {
      return makePath(m, `${m.instanceName}.temperature`)
    },
    conversion: celsiusToKelvin
  },
  '/Soc': {
    path: m => {
      return makePath(m, `${m.instanceName}.capacity.stateOfCharge`)
    },
    conversion: percentToRatio
  },
  '/TimeToGo': {
    path: m => `electrical.batteries.${m.instanceName}.capacity.timeRemaining`
  },
  '/ConsumedAmphours': {
    path: m => `electrical.batteries.${m.instanceName}.capacity.consumedCharge`,
    conversion: ahToCoulomb
  },
  '/History/LastDischarge': {
    path: m =>
      `electrical.batteries.${m.instanceName}.capacity.dischargeSinceFull`,
    conversion: ahToCoulomb
  },
  '/History/TotalAhDrawn': {
    path: m => `electrical.batteries.${m.instanceName}.lifetimeDischarge`,
    conversion: ahToCoulomb
  },
  '/Pv/I': {
    path: m => `electrical.solar.${m.instanceName}.panelCurrent`
  },
  '/Pv/V': {
    path: m => `electrical.solar.${m.instanceName}.panelVoltage`
  },
  '/Yield/Power': {
    path: m => `electrical.solar.${m.instanceName}.panelPower`
  },
  '/History/Daily/0/Yield': {
    path: m => `electrical.solar.${m.instanceName}.yieldToday`
  },
  '/History/Daily/1/Yield': {
    path: m => `electrical.solar.${m.instanceName}.yieldYesterday`
  },
  '/State': [
    {
      path: m => {
        return makePath(m, `${m.instanceName}.${getStatePropName(m)}`)
      },
      conversion: convertState
    },
    {
      path: m => {
        return makePath(m, `${m.instanceName}.${getStatePropName(m)}Number`)
      }
    },

    // this is so that we put out a inverter.inverterMode value for vebus types
    {
      path: m => {
        return makePath(m, `${m.instanceName}.inverterMode`, true)
      },
      conversion: msg => {
        return isVEBus(msg) ? convertState(msg) : null
      }
    },
    {
      path: m => {
        return makePath(m, `${m.instanceName}.inverterModeNumber`, true)
      },
      conversion: msg => {
        return isVEBus(msg) ? msg.value : null
      }
    }
  ],
  '/Mode': [
    {
      path: m => {
        return makePath(m, `${m.instanceName}.mode`)
      },
      conversion: convertMode
    },
    {
      path: m => {
        return makePath(m, `${m.instanceName}.modeNumber`)
      }
    }
  ],
  '/ErrorCode': {
    path: m => {
      return 'notifications.' + makePath(m, `${m.instanceName}.error`)
    },
    conversion: convertErrorToNotification
  },
  '/Capacity': {
    path: m => {
      return (
        'tanks.' + getFluidType(m.fluidType) + `.${m.instanceName}.capacity`
      )
    }
  },
  '/Level': {
    path: m => {
      return (
        'tanks.' + getFluidType(m.fluidType) + `.${m.instanceName}.currentLevel`
      )
    },
    conversion: percentToRatio
  },
  '/Ac/ActiveIn/L1/I': {
    path: m => {
      return makePath(m, `${m.instanceName}.acin.current`, true)
    }
  },
  '/Ac/ActiveIn/L1/P': {
    path: m => {
      return makePath(m, `${m.instanceName}.acin.power`, true)
    }
  },
  '/Ac/ActiveIn/L1/V': {
    path: m => {
      return makePath(m, `${m.instanceName}.acin.voltage`, true)
    }
  },
  '/Ac/ActiveIn/L2/I': {
    path: m => {
      return makePath(m, `${m.instanceName}.acin2.current`, true)
    }
  },
  '/Ac/ActiveIn/L2/P': {
    path: m => {
      return makePath(m, `${m.instanceName}.acin2.power`, true)
    }
  },
  '/Ac/ActiveIn/L2/V': {
    path: m => {
      return makePath(m, `${m.instanceName}.acin2.voltage`, true)
    }
  },
  '/Ac/ActiveIn/L3/I': {
    path: m => {
      return makePath(m, `${m.instanceName}.acin3.current`, true)
    }
  },
  '/Ac/ActiveIn/L3/P': {
    path: m => {
      return makePath(m, `${m.instanceName}.acin3.power`, true)
    }
  },
  '/Ac/ActiveIn/L3/V': {
    path: m => {
      return makePath(m, `${m.instanceName}.acin3.voltage`, true)
    }
  },
  '/Ac/Out/L1/I': {
    path: m => {
      return makePath(m, `${m.instanceName}.acout.current`, true)
    }
  },
  '/Ac/Out/L1/P': {
    path: m => {
      return makePath(m, `${m.instanceName}.acout.power`, true)
    }
  },
  '/Ac/Out/L1/V': {
    path: m => {
      return makePath(m, `${m.instanceName}.acout.voltage`, true)
    }
  },
  '/Ac/Out/L2/I': {
    path: m => {
      return makePath(m, `${m.instanceName}.acout2.current`, true)
    }
  },
  '/Ac/Out/L2/P': {
    path: m => {
      return makePath(m, `${m.instanceName}.acout2.power`, true)
    }
  },
  '/Ac/Out/L2/V': {
    path: m => {
      return makePath(m, `${m.instanceName}.acout2.voltage`, true)
    }
  },
  '/Ac/Out/L3/I': {
    path: m => {
      return makePath(m, `${m.instanceName}.acout3.current`, true)
    }
  },
  '/Ac/Out/L3/P': {
    path: m => {
      return makePath(m, `${m.instanceName}.acout3.power`, true)
    }
  },
  '/Ac/Out/L3/V': {
    path: m => {
      return makePath(m, `${m.instanceName}.acout3.voltage`, true)
    }
  },
  '/ExtraBatteryCurrent': {
    path: m => {
      return `electrical.batteries.${m.instanceName}starter.current`
    }
  },
  '/Relay/0/State': {
    path: 'electrical.switches.venus-0.state',
    requiresInstance: false
  },
  '/Relay/1/State': {
    path: 'electrical.switches.venus-1.state',
    requiresInstance: false
  },
  '/Dc/System/Power': {
    path: 'electrical.venus.dcPower',
    requiresInstance: false
  },
  '/Course': {
    path: 'navigation.courseOverGroundTrue',
    requiresInstance: false,
    conversion: msg => degsToRad
  },
  '/Speed': {
    path: 'navigation.speedOverGround',
    requiresInstance: false
  },
  '/Position/Latitude': {
    path: 'navigation.position',
    requiresInstance: false,
    conversion: msg => {
      if (lastLon) {
        lastLat = msg.value
        return { latitude: msg.value, longitude: lastLon }
      }
    }
  },
  '/Position/longitude': {
    path: 'navigation.position',
    requiresInstance: false,
    conversion: msg => {
      if (lastLat) {
        lastLon = msg.value
        return { latitude: lastLat, longitude: msg.value }
      }
    }
  }
}

// make all mappings arrays
forIn(venusToSignalKMapping, (value, key) => {
  if (!isArray(value)) {
    venusToSignalKMapping[key] = [value]
  }
})

module.exports = function (app, options, handleMessage) {
  function toDelta (messages) {
    var deltas = []

    messages.forEach(m => {
      debug(`${m.path}:${m.value}`)
      if (m.path.startsWith('/Alarms')) {
        deltas.push(getAlarmDelta(m))
        return
      }

      if (!m.senderName) {
        return
      }

      const mappings = venusToSignalKMapping[m.path] || []

      mappings.forEach(mapping => {
        let theValue = m.value

        if (
          (isUndefined(mapping.requiresInstance) || mapping.requiresInstance) &&
          !makePath(m)
        ) {
          debug(
            `mapping: skipping: ${m.senderName} ${mapping.requiresInstance}`
          )
          return
        }

        if (mapping.conversion) {
          theValue = mapping.conversion(m)
        }

        if (isUndefined(theValue) || theValue == null) {
          debug('mapping: no value')
          return
        }

        if (isArray(theValue)) {
          // seem to get this for some unknown values
          debug('mapping: value is array')
          return
        }

        var thePath = isFunction(mapping.path) ? mapping.path(m) : mapping.path

        var delta = makeDelta(m, thePath, theValue)
        deltas.push(delta)
      })
    })

    debug(`produced ${deltas.length} deltas`)
    return deltas
  }

  return { toDelta: toDelta }
}

function percentToRatio (msg) {
  return msg.value / 100.0
}

function makePath (msg, path, vebusIsInverterValue) {
  var type

  if (msg.senderName.startsWith('com.victronenergy.battery')) {
    type = 'batteries'
  } else if (msg.senderName.startsWith('com.victronenergy.solarcharger')) {
    type = 'solar'
  } else if (msg.senderName.startsWith('com.victronenergy.charger')) {
    type = 'chargers'
  } else if (msg.senderName.startsWith('com.victronenergy.inverter')) {
    type = 'inverters'
  } else if (msg.senderName.startsWith('com.victronenergy.vebus')) {
    type = isUndefined(vebusIsInverterValue) ? 'chargers' : 'inverters'
  } else if (msg.senderName.startsWith('com.victronenergy.tank')) {
    type = 'tanks'
  } else {
    return null
  }
  return 'electrical.' + type + '.' + (path || '')
}

const stateMaps = {
  'com.victronenergy.solarcharger': {
    0: 'not charging',
    2: 'other',
    3: 'bulk',
    4: 'acceptance',
    5: 'float',
    6: 'other',
    7: 'equalize',
    252: 'ESS'
  },

  'com.victronenergy.vebus': {
    0: 'off',
    1: 'low power',
    2: 'fault',
    3: 'bulk',
    4: 'absortion',
    5: 'float',
    6: 'storage',
    7: 'equalize',
    8: 'passthru',
    9: 'inverting',
    10: 'power assist',
    11: 'power supply',
    252: 'bulk protection'
  },

  'com.victronenergy.charger': {
    0: 'off',
    1: 'low power mode',
    2: 'fault',
    3: 'bulk',
    4: 'absorption',
    5: 'float',
    6: 'storage',
    7: 'equalize',
    8: 'passthru',
    9: 'inverting',
    10: 'power assist',
    11: 'power supply',
    252: 'bulk protection'
  },

  'com.victronenergy.inverter': {
    0: 'off',
    1: 'low power mode',
    2: 'fault',
    9: 'inverting'
  }
}

function senderNamePrefix (senderName) {
  return senderName.substring(0, senderName.lastIndexOf('.'))
}

function isVEBus (msg) {
  return senderNamePrefix(msg.senderName) === 'com.victronenergy.vebus'
}

function convertState (msg, forInverter) {
  var map = stateMaps[senderNamePrefix(msg.senderName)]
  return map[Number(msg.value)] || 'unknown'
}

function convertStateForVEBusInverter (msg) {
  return convertState(msg, true)
}

const modeMaps = {
  'com.victronenergy.vebus': {
    1: 'charger only',
    2: 'inverter only',
    3: 'on',
    4: 'off'
  },
  'com.victronenergy.charger': {
    0: 'off',
    1: 'on',
    2: 'error',
    3: 'unavailable'
  },
  'com.victronenergy.solarcharger': {
    1: 'on',
    4: 'off'
  },
  'com.victronenergy.inverter': {
    2: 'on',
    4: 'off',
    5: 'echo'
  }
}

const statePropName = {
  'com.victronenergy.vebus': 'chargingMode',
  'com.victronenergy.charger': 'chargingMode',
  'com.victronenergy.solarcharger': 'controllerMode',
  'com.victronenergy.inverter': 'inverterMode'
}

function getStatePropName (msg) {
  return statePropName[senderNamePrefix(msg.senderName)]
}

function convertMode (msg) {
  var modeMap = modeMaps[senderNamePrefix(msg.senderName)]
  return (modeMap && modeMap[Number(msg.value)]) || 'unknown'
}

const solarErrorCodeMap = {
  0: 'No error',
  1: 'Battery temperature too high',
  2: 'Battery voltage too high',
  3: 'Battery temperature sensor miswired (+)',
  4: 'Battery temperature sensor miswired (-)',
  5: 'Battery temperature sensor disconnected',
  6: 'Battery voltage sense miswired (+)',
  7: 'Battery voltage sense miswired (-)',
  8: 'Battery voltage sense disconnected',
  9: 'Battery voltage wire losses too high',
  17: 'Charger temperature too high',
  18: 'Charger over-current',
  19: 'Charger current polarity reversed',
  20: 'Bulk time limit reached',
  22: 'Charger temperature sensor miswired',
  23: 'Charger temperature sensor disconnected',
  34: 'Input current too high'
}

function convertErrorToNotification (m) {
  var value
  if (m.value == 0) {
    value = { state: 'normal', message: 'No Error' }
  } else {
    var msg
    if (m.senderName.startsWith('com.victronenergy.solarcharger')) {
      msg = solarErrorCodeMap[m.value]
    }

    if (!msg) {
      msg = `Unknown Error ${m.value}: ${m.text}`
    }

    value = {
      state: 'alarm',
      message: msg,
      method: ['visual', 'sound']
    }
  }

  return value
}

function convertAlarmToNotification (m) {
  var value
  if (m.value == null || m.value == 0) {
    value = { state: 'normal', message: 'No Alarm' }
  } else {
    var message
    if (_.isString(m.value)) {
      message = m.value
    } else {
      message = m.path.split('/')[2]
    }

    value = {
      state: m.value == 1 ? 'warning' : 'alarm',
      message: message,
      method: ['visual', 'sound']
    }
  }

  return value
}

function ahToCoulomb (m) {
  return Number(m.value) * 3600
}

function celsiusToKelvin (m) {
  return Number(m.value) + 273.15
}

function degsToRad (m) {
  return Number(m.value) * (Math.PI / 180.0)
}

const fluidTypeMapping = {
  0: 'fuel',
  1: 'freshWater',
  2: 'greyWater',
  3: 'liveWell',
  4: 'lubrication',
  5: 'blackWater'
}

function getFluidType (typeId) {
  return fluidTypeMapping[typeId] || 'unknown'
}

function makeDelta (m, path, value) {
  return {
    updates: [
      {
        source: {
          label: 'venus',
          sender: m.sender,
          senderName: m.senderName,
          venusPath: m.path
        },
        values: [
          {
            path: path,
            value: value
          }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  }
}

function getAlarmDelta (msg) {
  var name = msg.path.substring(1).replace(/\//g, '.') // alarms.LowVoltage
  name = name.substring(name.indexOf('.') + 1) // LowVoltate
  name = name.charAt(0).toLowerCase() + name.substring(1) // lowVoltate

  var path = 'notifications.' + makePath(msg, `${msg.instanceName}.${name}`)
  var value = convertAlarmToNotification(msg)
  return makeDelta(msg, path, value)
}
