const _ = require('lodash')

const mappings = {
  '/Dc/0/Voltage': {
    path: 'electrical.batteries.${instance}.voltage'
  },
  '/Dc/1/Voltage': {
    path: 'electrical.batteries.${instance}.voltage'
  },
  "/Dc/0/Current": {
    path: 'electrical.batteries.${instance}.current'
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
  }
}

module.exports = function (venusMessage) {
  if (venusMessage.interface != 'com.victronenergy.BusItem' ||
      venusMessage.member != 'PropertiesChanged')
    return []

  var mapping = mappings[venusMessage.path]
  if ( !mapping || !venusMessage.senderName )
    return []

  var instance = venusMessage.senderName
  var theValue = venusMessage.value

  if ( mapping.conversion )
    theValue = mapping.conversion(theValue)

  var thePath;
  
  thePath = _.isFunction(mapping.path) ? mapping.path(venusMessage) : mapping.path.replace(/\$\{instance\}/g, instance);
  
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

