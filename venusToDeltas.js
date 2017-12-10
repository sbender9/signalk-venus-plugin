const _ = require('lodash')
const debug = require("debug")("venusToDeltas")

const mappings = {
  '/Dc/0/Voltage': {
    path: (msg) => { return makePath(msg, '${instance}.voltage') }
  },
  '/Dc/1/Voltage': {
    path: (msg) => { return makePath(msg, '${instance}.voltage') }
  },
  "/Dc/0/Current": {
    path: (msg) => { return makePath(msg, '${instance}.current') }
  },
  "/Dc/0/Power": {
    path: (msg) => { return makePath(msg, '${instance}.power') }
  },
  '/Soc': {
    path: (msg) => { return makePath(msg, '${instance}.capacity.stateOfCharge') },
    conversion: percentToRatio
  },
  '/TimeToGo': {
    path: 'electrical.batteries.${instance}.capacity.timeRemaining'
  },
  '/History/LastDischarge': {
    path: 'electrical.batteries.${instance}.capacity.dischargeSinceFull',
    conversion: ahToCoulomb
  },
  '/History/TotalAhDrawn': {
    path: 'electrical.batteries.${instance}.lifetimeDischarge',
    conversion: ahToCoulomb
  },
  '/Pv/I': {
    path: 'electrical.solar.${instance}.panelCurrent'
  },
  '/Pv/V': {
    path: 'electrical.solar.${instance}.panelVoltage'
  },
  '/Yield/Power': {
    path: 'electrical.solar.${instance}.panelPower'
  },
  '/History/Daily/0/Yield': {
    path: 'electrical.solar.${instance}.yieldToday'
  },
  '/State': {
    path: (msg) => { return makePath(msg, '${instance}.chargingMode') },
    conversion: convertState
  },
  '/Mode': {
    path: (msg) => { return makePath(msg, '${instance}.mode') },
    conversion: convertMode
  },
  '/ErrorCode': {
    path: (msg) => {
      return 'notifications.' + makePath(msg, '${instance}.error')
    },
    conversion: convertErrorToNotification
  },
  '/Alarms/LowVoltage': {
    path: (msg) => {
      return 'notifications.' + makePath(msg, '${instance}.lowVoltage')
    },
    conversion: convertAlarmToNotification
  },
  '/Alarms/HighVoltage': {
    path: (msg) => {
      return 'notifications.' + makePath(msg, '${instance}.highVoltage')
    },
    conversion: convertAlarmToNotification
  },
  '/Alarms/LowStarterVoltage': {
    path: (msg) => {
      return 'notifications.' + makePath(msg, '${instance}.lowStarterVoltage')
    },
    conversion: convertAlarmToNotification
  },
  '/Alarms/HighStarterVoltage': {
    path: (msg) => {
      return 'notifications.' + makePath(msg, '${instance}.highStarterVoltage')
    },
    conversion: convertAlarmToNotification
  },
  '/Alarms/HighTemperature': {
    path: (msg) => {
      return 'notifications.' + makePath(msg, '${instance}.highTemperature')
    },
    conversion: convertAlarmToNotification
  },
  '/Alarms/LowSoc': {
    path: (msg) => {
      return 'notifications.' + makePath(msg, '${instance}.lowSoc')
    },
    conversion: convertAlarmToNotification
  },
  '/Alarms/LowTemperature': {
    path: (msg) => {
      return 'notifications.' + makePath(msg, '${instance}.lowTemperature')
    },
    conversion: convertAlarmToNotification
  },
  '/Alarms/MidVoltage': {
    path: (msg) => {
      return 'notifications.' + makePath(msg, '${instance}.midVoltage')
    },
    conversion: convertAlarmToNotification
  },
  '/Capacity': {
    path: (msg) => {
      return 'tanks.' + getFluidType(msg.fluidType) + '.${instance}.capacity'
    },
  },
  '/Level': {
    path: (msg) => {
      return 'tanks.' + getFluidType(msg.fluidType) + '.${instance}.currentLevel'
    },
    conversion: percentToRatio
  },
  '/Ac/ActiveIn/L1/I': {
    path: (msg) => { return makePath(msg, '${instance}.acin.current') }
  },
  '/Ac/ActiveIn/L1/P': {
    path: (msg) => { return makePath(msg, '${instance}.acin.power') }
  },
  '/Ac/ActiveIn/L1/V': {
    path: (msg) => { return makePath(msg, '${instance}.acin.voltage') }
  },
  '/Ac/ActiveIn/L2/I': {
    path: (msg) => { return makePath(msg, '${instance}.acin2.current') }
  },
  '/Ac/ActiveIn/L2/P': {
    path: (msg) => { return makePath(msg, '${instance}.acin2.power') }
  },
  '/Ac/ActiveIn/L2/V': {
    path: (msg) => { return makePath(msg, '${instance}.acin2.voltage') }
  },
  '/Ac/ActiveIn/L3/I': {
    path: (msg) => { return makePath(msg, '${instance}.acin3.current') }
    },
  '/Ac/ActiveIn/L3/P': {
    path: (msg) => { return makePath(msg, '${instance}.acin3.power') }
  },
  '/Ac/ActiveIn/L3/V': {
    path: (msg) => { return makePath(msg, '${instance}.acin3.voltage') }
  },
  '/Ac/Out/L1/I': {
    path: (msg) => { return makePath(msg, '${instance}.acout.current') }
  },
  '/Ac/Out/L1/P': {
    path: (msg) => { return makePath(msg, '${instance}.acout.power') }
  },
  '/Ac/Out/L1/V': {
    path: (msg) => { return makePath(msg, '${instance}.acout.voltage') }
  },
  '/Ac/Out/L2/I': {
    path: (msg) => { return makePath(msg, '${instance}.acout2.current') }
  },
  '/Ac/Out/L2/P': {
    path: (msg) => { return makePath(msg, '${instance}.acout2.power') }
  },
  '/Ac/Out/L2/V': {
    path: (msg) => { return makePath(msg, '${instance}.acout2.voltage') }
  },
  '/Ac/Out/L3/I': {
    path: (msg) => { return makePath(msg, '${instance}.acout3.current') }
  },
  '/Ac/Out/L3/P': {
    path: (msg) => { return makePath(msg, '${instance}.acout3.power') }
  },
  '/Ac/Out/L3/V': {
    path: (msg) => { return makePath(msg, '${instance}.acout3.voltage') }
  },
  '/ExtraBatteryCurrent': {
    path: (msg) => { return 'electrical.batteries.${instance}b.current' }
  }
}

module.exports = function (messages) {
  var deltas = []

  messages.forEach(m => {
    var mapping = mappings[m.path]
    if ( !mapping || !m.senderName )
      return []

    var instance = m.instanceName
    var theValue = m.value

    if ( !makePath(m) ) {
      return []
    }

    if ( mapping.conversion )
      theValue = mapping.conversion(m)

    if ( _.isUndefined(theValue) || theValue == null )
      return []

    if ( _.isArray(theValue) ) //seem to get this for some unknown values
      return []

    var thePath;

    thePath = _.isFunction(mapping.path) ?
      mapping.path(m) :
      mapping.path;

    thePath = thePath.replace(/\$\{instance\}/g, instance);

    deltas.push({
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
              path: thePath,
              value: theValue
            }
          ],
          timestamp: (new Date()).toISOString()
        }
      ]
    });
  });
  return deltas;
}

function percentToRatio(msg) {
  return msg.value / 100.0
}

function makePath(msg, path) {
  var type;

  if ( msg.senderName.startsWith('com.victronenergy.battery') ) {
    type = 'batteries'
  } else if ( msg.senderName.startsWith('com.victronenergy.solarcharger') ) {
    type = 'solar'
  } else if ( msg.senderName.startsWith('com.victronenergy.inverter') ) {
    type = 'inverters'
  } else if ( msg.senderName.startsWith('com.victronenergy.vebus') ) {
    type = 'inverterCharger'
  } else if ( msg.senderName.startsWith('com.victronenergy.tank') ) {
    type = 'tanks'
  } else {
    return null
  }
  return 'electrical.' + type + '.' + (path || '');
}

const solarStateMap= {
  0: 'not charging',
  2: 'other',
  3: 'bulk',
  4: 'acceptance',
  5: 'float',
  6: 'other',
  7: 'equalize',
};

const vebusStateMap = {
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
}

function convertState(msg) {
  var map
  if ( msg.senderName.startsWith('com.victronenergy.solarcharger') ) {
    map = solarStateMap
  } else if ( msg.senderName.startsWith('com.victronenergy.vebus') ) {
    map = vebusStateMap
  }
  return map[Number(msg.value)] || 'unknown'
}

const vebusModeMap = {
  1: 'charger only',
  2: 'inverter only',
  3: 'on',
  4: 'off'
}

function convertMode(msg) {
  return vebusModeMap[Number(msg.value)] || 'unknown'
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


function convertErrorToNotification(m) {
  var value;
  if ( m.value == 0 ) {
    value = { state: 'normal', message: 'No Error' }
  } else {
    var msg;
    if ( m.senderName.startsWith('com.victronenergy.solarcharger') ) {
      msg = solarErrorCodeMap[m.value];
    }

    if ( !msg ) {
      msg = `Unknown Error ${m.value}: ${m.text}`
    }

    value = {
      state: 'alarm',
      message: msg,
      method: [ "visual", "sound" ]
    }
  }

  return value;
}

function convertAlarmToNotification(m) {
  var value;
  if ( m.value == null || m.value == 0 ) {
    value = { state: 'normal', message: 'No Alarm' }
  } else {

    var message
    if ( _.isString(m.value) ) {
      message = m.value
    } else {
      message = m.path.split('/')[2]
    }
    
    value = {
      state: m.value == 1 ? 'warning' : 'alarm',
      message: message,
      method: [ "visual", "sound" ]
    }
  }

  return value;
}

function ahToCoulomb(m) {
  return Number(m.value) * 3600;
}

const fluidTypeMapping = {
  0: "fuel",
  1: "water",
  2: "greywater",
  3: "liveWell",
  4: "lubrication",
  5: "blackwater"
}

function getFluidType(typeId) {
  debug(`getFluidType ${typeId} ${fluidTypeMapping[typeId]}`)
  return fluidTypeMapping[typeId] || 'unknown';
}
