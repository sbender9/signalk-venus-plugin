const { isArray, isFunction, isUndefined, values, forIn } = require('lodash')
const _ = require('lodash')

module.exports = function (app, options, state, putRegistrar) {
  const debug = app && app.debug ? app.debug.extend('venusToDeltas') : () => {}

  state.knownPaths = []
  state.sentModeMeta = false
  state.loggedUnknowns = []
  
  const venusToSignalKMapping = {
    '/CustomName': [
      {
        path: m => {
          return m.value && m.value.length > 0 && makePath(m, `${m.instanceName}.name`)
        }
      },
      {
        path: m => {
          if ( m.senderName.startsWith('com.victronenergy.vebus') ) {
            return m.value && m.value.length > 0 && makePath(m, `${m.instanceName}.name`, true)
          }
        }
      }
    ],
    '/Settings/SystemSetup/SystemName': {
      path: m => {
        return makePath(m, `name`)
      },
      requiresInstance: false
    },
    '/Dc/0/Voltage': {
      path: m => {
        return makePath(m, `${m.instanceName}.voltage`)
      },
      units: 'V'
    },
    '/Dc/1/Voltage': {
      path: m => {
        return makePath(m, `${m.instanceName}-second.voltage`)
      },
      units: 'V'
    },
    '/Dc/0/Current': {
      path: m => {
        return makePath(m, `${m.instanceName}.current`)
      },
      units: 'A'
    },
    '/Dc/0/Power': {
      path: m => {
        return makePath(m, `${m.instanceName}.power`)
      },
      units: 'W'
    },
    '/Dc/0/Temperature': {
      path: m => {
        return makePath(m, `${m.instanceName}.temperature`)
      },
      conversion: celsiusToKelvin,
      units: 'K'
    },
    '/Dc/0/MidVoltageDeviation': {
      path: m => {
        return makePath(m, `${m.instanceName}.midVoltageDeviation`)
      },
      units: 'V'
    },
    '/Dc/0/MidVoltage': {
      path: m => {
        return makePath(m, `${m.instanceName}.midVoltage`)
      },
      units: 'V'
    },
    '/Soc': {
      path: m => {
        return makePath(m, `${m.instanceName}.capacity.stateOfCharge`)
      },
      conversion: percentToRatio,
      units: 'ratio'
    },
    '/TimeToGo': {
      path: m => `electrical.batteries.${m.instanceName}.capacity.timeRemaining`,
      sendNulls: true
    },
    '/ConsumedAmphours': {
      path: m => `electrical.batteries.${m.instanceName}.capacity.consumedCharge`,
      conversion: ahToCoulomb,
      units: 'C'
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
    '/History/DischargedEnergy' : {
      path: m => `electrical.batteries.${m.instanceName}.capacity.dischargedEnergy`,
      conversion: ahToCoulomb,
      units: 'C'
    },
    '/Pv/I': {
      path: m => `electrical.solar.${m.instanceName}.panelCurrent`,
      units: 'A'
    },
    '/Pv/V': {
      path: m => `electrical.solar.${m.instanceName}.panelVoltage`,
      units: 'V'
    },
    '/Yield/Power': {
      path: m => `electrical.solar.${m.instanceName}.panelPower`,
      units: 'W'
    },
    '/History/Daily/0/Yield': {
      path: m => `electrical.solar.${m.instanceName}.yieldToday`,
      conversion: kWhToJoules,
      units: 'J'
    },
    '/History/Daily/1/Yield': {
      path: m => `electrical.solar.${m.instanceName}.yieldYesterday`,
      conversion: kWhToJoules,
      units: 'J'
    },
    '/Load/State': {
      path: m => {
        return makePath(m, `${m.instanceName}.loadState`)
      },
    },
    '/MppOperationMode': [
      {
        path: m => {
          return makePath(m, `${m.instanceName}.operationMode`)
        },
        conversion: convertMppOperationMode
      },
      {
        path: m => {
          return makePath(m, `${m.instanceName}.operationModeNumber`)
        }
      }
    ],
    '/Leds/Temperature': {
      path: m => {
        return makePath(m, `${m.instanceName}.leds.temperature`)
      },
      meta: {
        displayName: 'Temperature',
        onColor: 'bad',
        order: 1
      }
    },
    '/Leds/LowBattery': {
      path: m => {
        return makePath(m, `${m.instanceName}.leds.lowBattery`)
      },
      meta: {
        displayName: 'Low Battery',
        onColor: 'bad',
        order: 2
      }
    },
    '/Leds/Overload': {
      path: m => {
        return makePath(m, `${m.instanceName}.leds.overload`)
      },
      meta: {
        displayName: 'Overload',
        onColor: 'bad',
        order: 3
      }
    },
    '/Leds/Inverter': {
      path: m => {
        return makePath(m, `${m.instanceName}.leds.inverter`)
      },
      meta: {
        displayName: 'Inverter',
        order: 4
      }
    },
    '/Leds/Float': {
      path: m => {
        return makePath(m, `${m.instanceName}.leds.float`)
      },
      meta: {
        displayName: 'Float',
        order: 5
      }
    },
    '/Leds/Bulk': {
      path: m => {
        return makePath(m, `${m.instanceName}.leds.bulk`)
      },
      meta: {
        displayName: 'Bulk',
        order: 6
      }
    },
    '/Leds/Absorption': {
      path: m => {
        return makePath(m, `${m.instanceName}.leds.absorption`)
      },
      meta: {
        displayName: 'Absorption',
        order: 7,
      }
    },
    '/Leds/Mains': {
      path: m => {
        return makePath(m, `${m.instanceName}.leds.mains`)
      },
      meta: {
        displayName: 'Mains',
        order: 8
      }
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
          let propName = getStatePropName(m)
          if ( propName ) {
            return makePath(m, `${m.instanceName}.${propName}Number`)
          }
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
    '/Devices/0/ExtendStatus/PreferRenewableEnergy': {
      path: m => {
        return makePath(m, `${m.instanceName}.preferRenewableEnergy`, true)
      },
    },
    '/Devices/0/ExtendStatus/PreferRenewableEnergyActive': {
      path: m => {
        return makePath(m, `${m.instanceName}.preferRenewableEnergyActive`, true)
      },
    },
    'Devices/0/ExtendStatus/SustainMode': {
      path: m => {
        return makePath(m, `${m.instanceName}.sustainMode`, true)
      },
    },
    '/Mode': [
      {
        path: m => {
          return makePath(m, `${m.instanceName}.mode`)
        },
        conversion: convertMode,
        putSupport: (m) => {
          if ( m.senderName.startsWith('com.victronenergy.vebus') ) {
            return {
              conversion: convertVeBusModeString,
              confirmChange: (value, input) => {
                return convertVeBusMode(input) === value
              }
            }
          }
        },
        meta: (m) => {
          if ( m.senderName.startsWith('com.victronenergy.vebus') ) {
            return modeMeta
          }
        }
      },
      {
        path: m => {
          return makePath(m, `${m.instanceName}.modeNumber`)
        },
        putSupport: (m) => { return {} },
        meta: (m) => {
          if ( m.senderName.startsWith('com.victronenergy.vebus') ) {
            return modeNumberMeta
          }
        }
      },
      {
        path: m => {
          return m.senderName.startsWith('com.victronenergy.solarcharger') ?
            makePath(m, `${m.instanceName}.modeSwitch.state`) : null
        },
        conversion: m => {
          return m.value === 1 ? 1 : 0
        },
        putSupport: (m) => {
          return {
            conversion: value => { return value === 1 || value === 'on' ? 1 : 0 }
          }
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
        return typeof m.fluidType === 'undefined' ? undefined : (
          'tanks.' + getFluidType(m.fluidType) + `.${m.instanceName}.capacity`
        )
      }
    },
    '/Remaining': {
      path: m => {
        return typeof m.fluidType === 'undefined' ? undefined : (
          'tanks.' + getFluidType(m.fluidType) + `.${m.instanceName}.remaining`
        )
      },
      units: 'm3'
    },
    '/Level': {
      path: m => {
        return typeof m.fluidType === 'undefined' ? undefined : (
          'tanks.' + getFluidType(m.fluidType) + `.${m.instanceName}.currentLevel`
        )
      },
      conversion: percentToRatio,
      units: 'ratio'
    },
    '/Temperature': {
      path: m => {
        return typeof m.temperatureType === 'undefined' ? undefined : (
          getTemperaturePath(m, options)
        )
      },
      conversion: celsiusToKelvin,
      units: 'K'
    },
    '/Humidity': {
      path: m => {
        return typeof m.temperatureType === 'undefined' ? undefined : (
          getTemperaturePath(m, options, 'humidity')
        )
      },
      conversion: percentToRatio,
      units: 'ratio'
    },
    '/Pressure': {
      path: m => {
        return typeof m.temperatureType === 'undefined' ? undefined : (
          getTemperaturePath(m, options, 'pressure')
        )
      },
      conversion: (msg) => {
        return msg.value * 100  // hPa -> Pa
      },
      units: 'Pa'
    },
    '/AccelX': {
      path: m => {
        return typeof m.temperatureType === 'undefined' ? undefined : (
          getTemperaturePath(m, options, 'accelerationX')
        )
      },
      units: 'g'
    },
    '/AccelY': {
      path: m => {
        return typeof m.temperatureType === 'undefined' ? undefined : (
          getTemperaturePath(m, options, 'accelerationY')
        )
      },
      units: 'g'
    },
    '/AccelZ': {
      path: m => {
        return typeof m.temperatureType === 'undefined' ? undefined : (
          getTemperaturePath(m, options, 'accelerationZ')
        )
      },
      units: 'g'
    },
    '/Ac/Current': {
      path: m => {
        return makePath(m, `${m.instanceName}.current`, true)
      },
      units: 'A'
    },
    '/Ac/Power': {
      path: m => {
        return makePath(m, `${m.instanceName}.power`, true)
      },
      units: 'W'
    },
    '/Ac/Voltage': {
      path: m => {
        return makePath(m, `${m.instanceName}.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/Energy/Forward': {
      path: m => {
        return makePath(m, `${m.instanceName}.energy.forward`, true)
      }
    },
    '/Ac/Energy/Reverse': {
      path: m => {
        return makePath(m, `${m.instanceName}.energy.reverse`, true)
      }
    },
    
    '/Ac/L1/Current': {
      path: m => {
        return makePath(m, `${m.instanceName}.l1.current`, true)
      },
      units: 'A'
    },
    '/Ac/L1/Power': {
      path: m => {
        return makePath(m, `${m.instanceName}.l1.power`, true)
      },
      units: 'W'
    },
    '/Ac/L1/Voltage': {
      path: m => {
        return makePath(m, `${m.instanceName}.l1.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/L1/Energy/Forward': {
      path: m => {
        return makePath(m, `${m.instanceName}.l1.energy.forward`, true)
      }
    },
    '/Ac/L1/Energy/Reverse': {
      path: m => {
        return makePath(m, `${m.instanceName}.l1.energy.reverse`, true)
      }
    },

    '/Ac/L3/Current': {
      path: m => {
        return makePath(m, `${m.instanceName}.l3.current`, true)
      },
      units: 'A'
    },
    '/Ac/L3/Power': {
      path: m => {
        return makePath(m, `${m.instanceName}.l3.power`, true)
      },
      units: 'W'
    },
    '/Ac/L3/Voltage': {
      path: m => {
        return makePath(m, `${m.instanceName}.l3.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/L3/Energy/Forward': {
      path: m => {
        return makePath(m, `${m.instanceName}.l3.energy.forward`, true)
      }
    },
    '/Ac/L3/Energy/Reverse': {
      path: m => {
        return makePath(m, `${m.instanceName}.l3.energy.reverse`, true)
      }
    },

    '/Ac/L2/Current': {
      path: m => {
        return makePath(m, `${m.instanceName}.l2.current`, true)
      },
      units: 'A'
    },
    '/Ac/L2/Power': {
      path: m => {
        return makePath(m, `${m.instanceName}.l2.power`, true)
      },
      units: 'W'
    },
    '/Ac/L2/Voltage': {
      path: m => {
        return makePath(m, `${m.instanceName}.l2.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/L2/Energy/Forward': {
      path: m => {
        return makePath(m, `${m.instanceName}.l2.energy.forward`, true)
      }
    },
    '/Ac/L2/Energy/Reverse': {
      path: m => {
        return makePath(m, `${m.instanceName}.l2.energy.reverse`, true)
      }
    },
    
    '/Ac/ActiveIn/Source': [
      {
        path: m => { return `electrical.${m.venusName}.acSource` },
        conversion: convertSource,
        requiresInstance: false
      },
      {
        path: m => { return `electrical.${m.venusName}.acSourceNumber` },
        requiresInstance: false
      },
      {
        path: m => {
          return makePath(m, `${m.instanceName}.acin.acSource`, true)
        },
        conversion: convertSource,
      },
      {
        path: m => {
          return makePath(m, `${m.instanceName}.acin.acSourceNumber`, true)
        },
      }
    ],
    '/Ac/ActiveIn/CurrentLimit': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin.currentLimit`, true)
      },
      units: 'A',
      putSupport: (m) => { return {} },
    },
    '/Ac/In/1/CurrentLimit': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin.1.currentLimit`, true)
      },
      units: 'A',
      putSupport: (m) => { return {} },
    },
    '/Ac/In/2/CurrentLimit': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin.2.currentLimit`, true)
      },
      units: 'A',
      putSupport: (m) => { return {} },
    },
    '/Ac/State/IgnoreAcIn1': {
      path: m => {
        return makePath(m, `${m.instanceName}.acState.ignoreAcIn1.state`, true)
      },
      putSupport: (m) => {
        return {
          putPath: m => '/Ac/Control/IgnoreAcIn1'
        }
      }
    },
    '/Ac/State/AcIn1Available': {
      path: m => {
        return makePath(m, `${m.instanceName}.acState.acIn1Available`, true)
      },
    },
    '/Ac/ActiveIn/L1/I': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin.current`, true)
      },
      units: 'A'
    },
    '/Ac/ActiveIn/L1/P': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin.power`, true)
      },
      units: 'W'
    },
    '/Ac/ActiveIn/L1/V': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/ActiveIn/L1/F': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin.frequency`, true)
      },
      units: 'Hz'
    },
    '/Ac/ActiveIn/L2/I': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin2.current`, true)
      },
      units: 'A'
    },
    '/Ac/ActiveIn/L2/P': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin2.power`, true)
      },
      units: 'W'
    },
    '/Ac/ActiveIn/L2/V': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin2.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/ActiveIn/L3/I': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin3.current`, true)
      },
      units: 'A'
    },
    '/Ac/ActiveIn/L3/P': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin3.power`, true)
      },
      units: 'W'
    },
    '/Ac/ActiveIn/L3/V': {
      path: m => {
        return makePath(m, `${m.instanceName}.acin3.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/Out/L1/I': {
      path: m => {
        return makePath(m, `${m.instanceName}.acout.current`, true)
      },
      units: 'A'
    },
    '/Ac/Out/L1/P': {
      path: m => {
        return makePath(m, `${m.instanceName}.acout.power`, true)
      },
      units: 'W'
    },
    '/Ac/Out/L1/V': {
      path: m => {
        return makePath(m, `${m.instanceName}.acout.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/Out/L1/F': {
      path: m => {
        return makePath(m, `${m.instanceName}.acout.frequency`, true)
      },
      units: 'Hz'
    },
    '/Ac/Out/L2/I': {
      path: m => {
        return makePath(m, `${m.instanceName}.acout2.current`, true)
      },
      units: 'A'
    },
    '/Ac/Out/L2/P': {
      path: m => {
        return makePath(m, `${m.instanceName}.acout2.power`, true)
      },
      units: 'W'
    },
    '/Ac/Out/L2/V': {
      path: m => {
        return makePath(m, `${m.instanceName}.acout2.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/Out/L3/I': {
      path: m => {
        return makePath(m, `${m.instanceName}.acout3.current`, true)
      },
      units: 'A'
    },
    '/Ac/Out/L3/P': {
      path: m => {
        return makePath(m, `${m.instanceName}.acout3.power`, true)
      },
      units: 'W'
    },
    '/Ac/Out/L3/V': {
      path: m => {
        return makePath(m, `${m.instanceName}.acout3.voltage`, true)
      },
      units: 'V'
    },
    '/Relay/0/State': {
      path: m => {
        if (m.senderName.startsWith('com.victronenergy.system'))
        {
          return (options.relayPath0 || 'electrical.switches.venus-0') + '.state'
        } else {
          return makePath(m, `${m.instanceName}.relay.state`, true)
        }
      },
      putSupport: (m) => {
        return {
          conversion: value => { return value === 1 || value === 'on' ? 1 : 0 }
        }
      },
      requiresInstance: false
    },
    '/Relay/1/State': {
      path: (options.relayPath1 || 'electrical.switches.venus-1') + '.state',
      putSupport: (m) => {
        return {
          conversion: value => { return value === 1 || value === 'on' ? 1 : 0 }
        }
      },
      requiresInstance: false
    },
    '/Dc/System/Power': {
      path: m => {
        return `electrical.${m.venusName}.dcPower`
      },
      requiresInstance: false,
      units: 'W'
    },
    '/Dc/Vebus/Power': {
      path: m => {
        return `electrical.${m.venusName}.vebusDcPower`
      },
      requiresInstance: false,
      units: 'W'
    },    
    '/Dc/Pv/Current': {
      path: m => {
        return `electrical.${m.venusName}.totalPanelCurrent`
      },
      requiresInstance: false,
      units: 'A'
    },
    '/Dc/Pv/Power': {
      path: m => {
        return `electrical.${m.venusName}.totalPanelPower`
      },
      requiresInstance: false,
      units: 'W'
    },
    '/Course': {
      path: 'navigation.courseOverGroundTrue',
      requiresInstance: false,
      conversion: degsToRad
    },
    '/Speed': {
      path: 'navigation.speedOverGround',
      requiresInstance: false
    },
    '/Position/Latitude': {
      path: 'navigation.position',
      requiresInstance: false,
      conversion: msg => {
        state.lastLat = msg.value
        if (state.lastLon && (_.isUndefined(options.usePosition) || options.usePosition)) {
          return { latitude: msg.value, longitude: state.lastLon, altitude: state.lastAltitude }
        }
      }
    },
    '/Position/Longitude': {
      path: 'navigation.position',
      requiresInstance: false,
      conversion: msg => {
        state.lastLon = msg.value
        if (state.lastLat && (_.isUndefined(options.usePosition) || options.usePosition)) {
          return { latitude: state.lastLat, longitude: msg.value, altitude: state.lastAltitude }
        }
      }
    },
    '/Altitude': {
      path: 'navigation.position',
      requiresInstance: false,
      conversion: msg => {
        state.lastAltitude = msg.value
        if (state.lastLat && state.lastLon && (_.isUndefined(options.usePosition) || options.usePosition)) {
          return { latitude: state.lastLat, longitude: state.lastLon, altitude: state.lastAltitude }
        }
      }
    },
    '/ExternalTemperature': {
      path: 'environment.outside.temperature',
      requiresInstance: false,
      conversion: celsiusToKelvin,
      units: 'K'
    },
    '/WindSpeed': {
      path: 'environment.wind.speedApparent',
      requiresInstance: false
    },
    '/SystemState/State': [
      {
        path: m => {
          return `electrical.${m.venusName}.state`
        },
        conversion: convertSystemState,
        requiresInstance: false
      },
      {
        path: m => {
          return `electrical.${m.venusName}.stateNumber`
        },
        requiresInstance: false
      },
    ],
    /*
    '/SystemState/BatteryLife': {
      path: m => {
        return `electrical.${m.venusName}.batteryLife`
      },
      requiresInstance: false
    },
    '/SystemState/ChargeDisabled': {
      path: m => {
        return `electrical.${m.venusName}.chargeDisabled`
      },
      requiresInstance: false
    },
    '/SystemState/DischargeDisabled': {
      path: m => {
        return `electrical.${m.venusName}.dischargeDisabled`
      },
      requiresInstance: false
    },
    '/SystemState/LowSoc': {
      path: m => {
        return `electrical.${m.venusName}.lowSoc`
      },
      requiresInstance: false
    },
    '/SystemState/SlowCharge': {
      path: m => {
        return `electrical.${m.venusName}.slowCharge`
      },
      requiresInstance: false
    },
    '/SystemState/UserChargeLimited': {
      path: m => {
        return `electrical.${m.venusName}.userChargeLimited`
      },
      requiresInstance: false
    },
    '/SystemState/UserDischargeLimited': {
      path: m => {
        return `electrical.${m.venusName}.userDischargeLimited`
      },
      requiresInstance: false
      },
      */
  }

  const digitalInputsMappings = {
    '/Count': {
      path: m => { return `electrical.venus-input.${m.instanceName}.count` }
    },
    '/State': [
      {
        path: m => { return `electrical.venus-input.${m.instanceName}.state` },
        conversion: mapInputState
      },
      {
        path: m => { return `electrical.venus-input.${m.instanceName}.stateNumber` }
      }
    ],
    '/InputState': {
      path: m => { return `electrical.venus-input.${m.instanceName}.inputState` }
    },
    '/ProductName': {
      path: m => { return `electrical.venus-input.${m.instanceName}.productName` }
    },
    '/Connected': {
      path: m => { return `electrical.venus-input.${m.instanceName}.connected` }
    },
    '/Type': {
      path: m => { return `electrical.venus-input.${m.instanceName}.type` }
    },
    '/CustomName': {
      path: m => { return `electrical.venus-input.${m.instanceName}.customName` }
    },
    
  }

  // make all mappings arrays
  forIn(venusToSignalKMapping, (value, key) => {
    if (!isArray(value)) {
      venusToSignalKMapping[key] = [value]
    }
  })
  forIn(digitalInputsMappings, (value, key) => {
    if (!isArray(value)) {
      digitalInputsMappings[key] = [value]
    }
  })

  function toDelta (messages) {
    var deltas = []

    messages.forEach(m => {
      debug('%j', m)
      if (m.path.startsWith('/Alarms')) {
        let delta  = getAlarmDelta(app, m)
        if ( delta ) {
          deltas.push(delta)
        }
        return deltas
      }

      if (!m.senderName) {
        return
      }


      let mappings

      if ( m.senderName.startsWith('com.victronenergy.digitalinput') ) {
        mappings = digitalInputsMappings[m.path] ? digitalInputsMappings[m.path] : []
      } else {
        mappings = venusToSignalKMapping[m.path] || []
      }

      /*
      if ( mappings.length === 0 && state.loggedUnknowns.indexOf(m.path) == -1) {
        console.log(JSON.stringify(m))
        state.loggedUnknowns.push(m.path)
        }
      */

      if ( _.isUndefined(m.venusName) ) {
        m.venusName = 'venus'
      }

      mappings.forEach(mapping => {
        let theValue = m.value
        
        if (
          ((isUndefined(mapping.requiresInstance) || mapping.requiresInstance) && isUndefined(m.instanceName)) || !makePath(m)
        ) {
          debug(
            `mapping: skipping: ${m.senderName} ${mapping.requiresInstance}`
          )
          return
        }

        var thePath = isFunction(mapping.path) ? mapping.path(m) : mapping.path

        if ( thePath === null ) {
          return
        }

        if (mapping.conversion && !isArray(theValue) && theValue != null) {
          theValue = mapping.conversion(m, thePath)
        }

        if (isArray(theValue)) {
          // seem to get this for unknown values
          theValue = null
        }
        
        if (!mapping.sendNulls &&
            (isUndefined(theValue) || theValue === null) &&
            state.knownPaths.indexOf(thePath) === -1 ) {
          debug('mapping: no value')
          return
        }
        
        if ( !_.isUndefined(thePath) && !_.isUndefined(theValue) ) {
          if ( state.knownPaths.indexOf(thePath) == -1 )
          {
            state.knownPaths.push(thePath)
            if ( app && app.supportsMetaDeltas ) {
              let meta = {}
              if ( mapping.units ) {
                meta.units = mapping.units
              }
              
              if ( mapping.meta ) {
                let mappingMeta = typeof mapping.meta === 'function' ?
                    mapping.meta(m) : mapping.meta
                if ( mappingMeta ) {
                  meta = { ...meta, ...mappingMeta }
                }
              }
              
              if ( Object.keys(meta).length > 0 )  {
                let delta = {updates: [
                  {
                    meta: [{ path: thePath, value: meta }]
                  }
                ]}
                deltas.push(delta)
              }
            }

            let putSupport = mapping.putSupport && mapping.putSupport(m)
            if ( putSupport && putRegistrar ) {
              let putPath
              if ( putSupport.putPath ) {
                putPath = putSupport.putPath(m)
              }
              putRegistrar(thePath, m, putSupport.conversion,
                           putSupport.confirmChange,
                           putPath)
            }
          }
          if ( !options.blacklist || options.blacklist.indexOf(thePath) == -1 ) {
            var delta = makeDelta(app, m, thePath, theValue)

            deltas.push(delta)
          }
        }
      })
    })

    debug(`produced ${deltas.length} deltas`)
    return deltas
  }

  function getKnownPaths() {
    return state.knownPaths
  }

  function hasCustomName(service) {
    return servicesWithCustomNames.indexOf(service) != -1
  }

  function makePath (msg, path, vebusIsInverterValue) {
    var type

    if (msg.senderName.startsWith('com.victronenergy.battery')) {
      type = 'batteries'
    } else if (msg.senderName.startsWith('com.victronenergy.dcload')) {
      type = 'dcload'
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
    } else if ( msg.senderName.startsWith('com.victronenergy.system') ||
                msg.senderName.startsWith('com.victronenergy.settings') ) {
      type = msg.venusName
    } else {
      let parts = msg.senderName.split('.')
      if ( parts.length > 2 ) {
        type = parts[2]
      } else {
        debug('no path for %s', msg.senderName)
        return null
      }
    }
    return 'electrical.' + type + '.' + (path || '')
  }

  function getAlarmDelta (app, msg) {
    if ( msg.senderName.startsWith('com.victronenergy.tank') ) {
      //ignore for now
      return
    }
    
    var name = msg.path.substring(1).replace(/\//g, '.') // alarms.LowVoltage
    name = name.substring(name.indexOf('.') + 1) // LowVoltate
    name = name.charAt(0).toLowerCase() + name.substring(1) // lowVoltate


    var path = makePath(msg, `${msg.instanceName}.${name}`)
    if ( !path ) {
      path = `electrical.venus.${msg.instanceName}.${name}`
    }
    var npath = 'notifications.' + path
    var value = convertAlarmToNotification(msg, npath)
    return value ? makeDelta(app, msg, npath, value) : null
  }

  function convertErrorToNotification (m, path) {
    var value

    if ( !app || !app.getSelfPath ) {
      return
    }

    const existing = app.getSelfPath(path)
    
    if (m.value == 0) {
      if ( existing && existing.value && existing.value.state !== 'normal' ) {
        value = { state: 'normal', message: 'No Error' }
      }
    } else {
      var msg
      if (m.senderName.startsWith('com.victronenergy.solarcharger')) {
        msg = solarErrorCodeMap[m.value]
      }

      if (!msg) {
        msg = `Unknown Error ${m.value}: ${m.text}`
      }

      let method = [ "visual", "sound" ]
      if ( existing && existing.value ) {
        method = existing.value.method
      }
      
      value = {
        state: 'alarm',
        message: msg,
        method,
      }
    }
    
    return value
  }

  function convertAlarmToNotification (m, path) {
    var value
    var message

    if ( !app || !app.getSelfPath ) {
      return
    }

    if (_.isString(m.value)) {
      message = m.value
    } else {
      message = m.path.split('/')[2]
    }
    const existing = app.getSelfPath(path)
    if (m.value == null || m.value == 0) {
      if ( existing && existing.value && existing.value.state !== 'normal' ) {
        value = { state: 'normal', message: message }
      }
    } else {
      let method = [ "visual", "sound" ]
      if ( existing && existing.value ) {
        method = existing.value.method
      }
      
      value = {
        state: m.value == 1 ? 'warning' : 'alarm',
        message: message,
        method
      }
    }
    
    return value
  }
  
  return { toDelta, getKnownPaths, hasCustomName }
}

function percentToRatio (msg) {
  return msg.value / 100.0
}

const stateMaps = {
  'com.victronenergy.solarcharger': {
    0: 'not charging',
    2: 'other',
    3: 'bulk',
    4: 'absorption',
    5: 'float',
    6: 'other',
    7: 'equalize',
    245: 'wake up',
    252: 'external control'
  },

  'com.victronenergy.vebus': {
    0: 'off',
    1: 'low power',
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
    244: 'sustain',
    245: 'wake up',
    252: 'external control',
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
  },

  'com.victronenergy.alternator': {
    0: 'off',
    1: 'bulk',
    2: 'absorbtion',
    5: 'float',
    7: 'external control',
    8: 'disabled',
    9: 'float'
  },

  'com.victronenergy.dcdc': {
    0: 'off',
    1: 'bulk',
    2: 'absorbtion',
    5: 'float',
    7: 'Ext Control',
    8: 'disabled',
    9: 'float'
  },
}

const systemStateMap = {
  0: 'off',
  1: 'low power',
  2: 'fault',
  3: 'bulk',
  4: 'absorption',
  5: 'float',
  6: 'storage',
  7: 'equalize',
  8: 'passthru',
  9: 'inverting',
  10: 'assisting',
  244: 'battery sustain',
  252: 'external control',
  256: 'discharging',
  257: 'sustain',
  258: 'recharge',
  259: 'scheduled recharge'
}

const mppOperationModeMap = {
  0: 'off',
  1: 'voltage/current limited',
  2: 'mppt active',
  255: 'not available'
}

function senderNamePrefix (senderName) {
  return senderName.substring(0, senderName.lastIndexOf('.'))
}

function isVEBus (msg) {
  return senderNamePrefix(msg.senderName) === 'com.victronenergy.vebus'
}

function convertSystemState(msg) {
  return systemStateMap[Number(msg.value)] || String(msg.value)
}
function convertMppOperationMode (msg) {
  return mppOperationModeMap[Number(msg.value)] || String(msg.value)
}

function convertState (msg, forInverter) {
  var map = stateMaps[senderNamePrefix(msg.senderName)]
  return (map && map[Number(msg.value)]) || String(msg.value)
}

function convertStateForVEBusInverter (msg) {
  return convertState(msg, true)
}

const servicesWithCustomNames = [
  'com.victronenergy.battery',
  'com.victronenergy.dcload',
  'com.victronenergy.solarcharger',
  'com.victronenergy.inverter',
  'com.victronenergy.vebus',
  'com.victronenergy.digitalinput'
]

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
    5: 'eco'
  },
  'com.victronenergy.battery': {
    0: 'sleep',
    1: 'hibernation',
    2: 'standby',
    3: 'on'
  },
  'com.victronenergy.alternator': {
    0: 'standalone',
    1: 'master',
    2: 'slave'
  },
  'com.victronenergy.dcdc': {
    0: 'standalone',
    1: 'master',
    2: 'slave'
  }
}

const statePropName = {
  'com.victronenergy.vebus': 'chargingMode',
  'com.victronenergy.charger': 'chargingMode',
  'com.victronenergy.solarcharger': 'controllerMode',
  'com.victronenergy.inverter': 'inverterMode',
  'com.victronenergy.battery': 'mode',
  'com.victronenergy.alternator': 'chargingMode',
  'com.victronenergy.dcdc': 'chargingMode',
  'com.victronenergy.system': 'state'
}

function getStatePropName (msg) {
  return statePropName[senderNamePrefix(msg.senderName)] || 'state'
}

function convertVeBusModeString(value) {
  var map = modeMaps['com.victronenergy.vebus']
  let entry = Object.entries(map).find(entry => { return entry[1] === value })
  return entry !== undefined ? Number(entry[0]) : undefined
}

function convertVeBusMode(value) {
  var modeMap = modeMaps['com.victronenergy.vebus']
  return (modeMap && modeMap[Number(value)]) || 'unknown'
}


function convertMode (msg) {
  var modeMap = modeMaps[senderNamePrefix(msg.senderName)]
  return (modeMap && modeMap[Number(msg.value)]) || 'unknown'
}

const acinSourceMap = {
  1: 'grid',
  2: 'genset',
  3: 'shore',
  240: 'battery'
}

function convertSource(msg) {
  return acinSourceMap[Number(msg.value)] || 'unknown'
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

function kWhToJoules (m) {
  return Number(m.value) * 3600000
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
  2: 'wasteWater',
  3: 'liveWell',
  4: 'lubrication',
  5: 'blackWater'
}

function getFluidType (typeId) {
  return fluidTypeMapping[typeId] || 'unknown'
}

function getTemperaturePath (m, options, name='temperature') {
  if ( options.temperatureMappings ) {
    const mapping = options.temperatureMappings.find(mapping => mapping.venusId == m.instanceName)
    if ( mapping ) {
      let path = mapping.signalkPath
      if ( name !== 'temperature' ) {
        let parts = path.split('.')
        path = parts.slice(0, parts.length-1).join('.') + `.${name}`
      }
      return path
    }
  }
  
  if ( m.temperatureType === 1 ) {
    return `environment.inside.refrigerator.${name}`
  } else {
    return `environment.venus.${m.instanceName}.${name}`
  }
}

const inputStateMapping = {
  0: 'Low',
  1: 'High',
  2: 'Off',
  3: 'On',
  4: 'No',
  5: 'Yes',
  6: 'Open',
  7: 'Closed',
  8: 'Alarm',
  9: 'OK',
  10: 'Running',
  11: 'Stopped'
}

function mapInputState(msg) {
  return inputStateMapping[msg.value] || 'unknown'
}


function makeDelta (app, m, path, value) {
  const delta = {
    updates: [
      {
        $source: `venus.${m.senderName.replace(/\:/g, '')}`,
        values: [
          {
            path: path,
            value: value
          }
        ]
      }
    ]
  }
  
  if (app
      && !app.supportsMetaDeltas
      && m.senderName.startsWith('com.victronenergy.vebus')
      && m.path === '/Mode'
      && path.endsWith('modeNumber'))
  {
    delta.updates[0].values.push({
      path: path + '.meta',
      value: modeMeta
    })
  }
  return delta
}

const modeNumberMeta = {
  displayName: 'Inverter Mode',
  type: 'multiple',
  possibleValues: [
    {
      title: 'On',
      value: 3
    },
    {
      title: 'Off',
      value: 4,
      isOn: false
    },
    {
      title: 'Charger Only',
      value: 1,
      abbrev: 'Chg'
    },
    {
      title: 'Inverter Only',
      value: 2,
      abbrev: 'Inv'
    }
  ]
}

const modeMeta = {
  displayName: 'Inverter Mode',
  type: 'multiple',
  possibleValues: [
    {
      title: 'On',
      value: 'on'
    },
    {
      title: 'Off',
      value: 'off',
      isOn: false
    },
    {
      title: 'Charger Only',
      value: 'charger only',
      abbrev: 'Chg'
    },
    {
      title: 'Inverter Only',
      value: 'inverter only',
      abbrev: 'Inv'
    }
  ]
}

