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
    path: 'electrical.chargers.${instance}.panelCurrent'
  },
  '/State': {
    path: 'electrical.chargers.${instance}.mode',
    conversion: convertState
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
    theValue = mapping.conversion(theValue)

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

function percentToRatio(percent) {
  return percent / 100.0
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
    type = 'chargers'
  } else {
    //TODO:  are there others needed here?
    type = 'charger'
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

function convertState(code) {
  return stateMap[Number(code)]
}

