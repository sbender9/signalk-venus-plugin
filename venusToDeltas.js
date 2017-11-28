const _ = require('lodash')

const mappings = {
  '/Dc/0/Voltage': {
    path: (msg) => { return batOrCharger(msg, '${instance}.voltage') }
  },
  '/Dc/1/Voltage': {
    path: (msg) => { return batOrCharger(msg, '${instance}.voltage') }
  },
  "/Dc/0/Current": {
    path: (msg) => { return batOrCharger(msg, '${instance}.current') }
  },
  '/Soc': {
    path: 'electrical.batteries.${instance}.capacity.stateOfCharge',
    conversion: percentToRatio
  },
  '/TimeToGo': {
    path: 'electrical.batteries.${instance}.capacity.timeRemaining'
  },
  '/Pv/I': {
    path: 'electrical.solar.${instance}.panelCurrent'
  },
  '/Pv/V': {
    path: 'electrical.solar.${instance}.panelVoltage'
  },
  '/State': {
    path: 'electrical.solar.${instance}.chargingMode',
    conversion: convertState
  },
  '/ErrorCode': {
    path: (msg) => {
      return 'notifications.' + batOrCharger(msg, '${instance}.error')
    },
    conversion: convertErrorToNotification
  }
}

module.exports = function (venusMessage) {
  if (venusMessage.interface != 'com.victronenergy.BusItem' ||
      venusMessage.member != 'PropertiesChanged')
    return []

  var mapping = mappings[venusMessage.path]
  if ( !mapping || !venusMessage.senderName )
    return []

  var instance = instanceFromSenderName(venusMessage.senderName)
  var theValue = venusMessage.value

  if ( mapping.conversion )
    theValue = mapping.conversion(venusMessage)

  if ( !theValue )
    return []
  
  var thePath;
  
  thePath = _.isFunction(mapping.path) ?
    mapping.path(venusMessage) :
    mapping.path;

  thePath = thePath.replace(/\$\{instance\}/g, instance);
  
  return [
    {
      updates: [
        {
          source: {
            label: 'venus',
            sender: venusMessage.sender,
            senderName: venusMessage.senderName,
            venusPath: venusMessage.path
          },
          values: [
            {
              path: thePath,
              value: theValue
            }
          ]
        }
      ]
    }
  ]
}

function percentToRatio(msg) {
  return msg.value / 100.0
}

function instanceFromSenderName(senderName) {
  //FIXME: hmmm??
  return 'vedirect' + senderName[senderName.length-1];
}


function batOrCharger(msg, path) {
  var type;

  if ( msg.senderName.startsWith('com.victronenergy.battery') ) {
    type = 'batteries'
  } else if ( msg.senderName.startsWith('com.victronenergy.solarcharger') ) {
    type = 'solar'
  } else if ( msg.senderName.startsWith('com.victronenergy.inverter') ) {
    type = 'inverters'
  } else {
    //TODO:  are there others needed here?
    type = 'chargers'
  }
  return 'electrical.' + type + '.' + path;
}
  
const stateMap= {
  0: 'not charging',
  2: 'fault',
  3: 'charging bulk',
  4: 'charging absorption',
  5: 'charging float',
  6: 'storage',
  7: 'equalize',
};
  
function convertState(msg) {
  return stateMap[Number(msg.value)]
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

  
function convertErrorToNotification(venusMessage) {
  var value;
  if ( venusMessage.value == 0 ) {
    value = { state: 'normal', message: 'No Error' }
  } else {
    var msg;
    if ( venusMessage.senderName.startsWith('com.victronenergy.solarcharger') ) {
      msg = solarErrorCodeMap[venusMessage.value];
    }
    
    if ( !msg ) {
      msg = `Unknown Error ${venusMessage.value}: ${venusMessage.text}`
    }
    
    value = {
      state: 'alarm',
      message: msg,
      method: [ "visual", "sound" ]
    }
  }

  return value;
}

