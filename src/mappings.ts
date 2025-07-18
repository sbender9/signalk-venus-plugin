/* eslint-disable @typescript-eslint/no-explicit-any */
import { ServerAPI } from '@signalk/server-api'

import {
  Message,
  makePath,
  celsiusToKelvin,
  percentToRatio,
  ahToCoulomb,
  kWhToJoules,
  convertMppOperationMode,
  getStatePropName,
  convertState,
  convertMode,
  isVEBus,
  convertVeBusMode,
  convertVeBusModeString,
  modeMeta,
  modeNumberMeta,
  getFluidType,
  getTemperaturePath,
  degsToRad,
  convertErrorToNotification,
  convertRuuivStatus,
  convertSource,
  convertRunningByConditionCode,
  convertSystemState,
  mapInputState
} from './venusToDeltas'

export type PutSupport = {
  conversion?: (value: any, input: any) => any
  putPath?: (m: Message) => string
  confirmChange?: (value: any, input: any) => boolean
}

export type VenusToSignalKMapping = {
  path: ((m: Message) => string | undefined) | string
  requiresInstance?: boolean
  units?: string
  conversion?: (value: any, path: string, forInverter?: boolean) => any
  sendNulls?: boolean
  meta?: any | ((m: Message) => any)
  putSupport?: (m: Message) => PutSupport | undefined
}

export type VenusToSignalKMappings = {
  [key: string]: VenusToSignalKMapping | VenusToSignalKMapping[]
}

export const getMappings = (
  app: ServerAPI,
  options: any,
  state: any
): VenusToSignalKMappings => {
  return {
    '/CustomName': [
      {
        path: (m) => {
          return (
            m.value &&
            m.value.length > 0 &&
            makePath(m, `${m.instanceName}.name`)
          )
        }
      },
      {
        path: (m) => {
          if (m.senderName.startsWith('com.victronenergy.vebus')) {
            return (
              m.value &&
              m.value.length > 0 &&
              makePath(m, `${m.instanceName}.name`, true)
            )
          }
        }
      }
    ],
    '/Settings/SystemSetup/SystemName': {
      path: (m) => {
        return makePath(m, `name`)
      },
      requiresInstance: false
    },
    '/Dc/0/Voltage': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.voltage`)
      },
      units: 'V'
    },
    '/Dc/1/Voltage': {
      path: (m) => {
        return makePath(m, `${m.instanceName}-second.voltage`)
      },
      units: 'V'
    },
    '/Dc/0/Current': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.current`)
      },
      units: 'A'
    },
    '/Dc/0/Power': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.power`)
      },
      units: 'W'
    },
    '/Dc/0/Temperature': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.temperature`)
      },
      conversion: celsiusToKelvin,
      units: 'K'
    },
    '/Dc/0/MidVoltageDeviation': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.midVoltageDeviation`)
      },
      units: 'V'
    },
    '/Dc/0/MidVoltage': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.midVoltage`)
      },
      units: 'V'
    },
    '/Soc': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.capacity.stateOfCharge`)
      },
      conversion: percentToRatio,
      units: 'ratio'
    },
    '/TimeToGo': {
      path: (m) =>
        `electrical.batteries.${m.instanceName}.capacity.timeRemaining`,
      sendNulls: true
    },
    '/ConsumedAmphours': {
      path: (m) =>
        `electrical.batteries.${m.instanceName}.capacity.consumedCharge`,
      conversion: ahToCoulomb,
      units: 'C'
    },
    '/History/LastDischarge': {
      path: (m) =>
        `electrical.batteries.${m.instanceName}.capacity.dischargeSinceFull`,
      conversion: ahToCoulomb
    },
    '/History/TotalAhDrawn': {
      path: (m) => `electrical.batteries.${m.instanceName}.lifetimeDischarge`,
      conversion: ahToCoulomb
    },
    '/History/DischargedEnergy': {
      path: (m) =>
        `electrical.batteries.${m.instanceName}.capacity.dischargedEnergy`,
      conversion: ahToCoulomb,
      units: 'C'
    },
    '/Pv/I': {
      path: (m) => `electrical.solar.${m.instanceName}.panelCurrent`,
      units: 'A'
    },
    '/Pv/V': {
      path: (m) => `electrical.solar.${m.instanceName}.panelVoltage`,
      units: 'V'
    },
    '/Yield/Power': {
      path: (m) => `electrical.solar.${m.instanceName}.panelPower`,
      units: 'W'
    },
    '/Yield/System': {
      path: (m) => `electrical.solar.${m.instanceName}.systemYield`,
      conversion: kWhToJoules,
      units: 'J'
    },
    '/History/Daily/0/Yield': {
      path: (m) => `electrical.solar.${m.instanceName}.yieldToday`,
      conversion: kWhToJoules,
      units: 'J'
    },
    '/History/Daily/1/Yield': {
      path: (m) => `electrical.solar.${m.instanceName}.yieldYesterday`,
      conversion: kWhToJoules,
      units: 'J'
    },
    '/Load/State': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.loadState`)
      }
    },
    '/MppOperationMode': [
      {
        path: (m) => {
          return makePath(m, `${m.instanceName}.operationMode`)
        },
        conversion: convertMppOperationMode
      },
      {
        path: (m) => {
          return makePath(m, `${m.instanceName}.operationModeNumber`)
        }
      }
    ],
    '/Leds/Temperature': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.leds.temperature`)
      },
      meta: {
        displayName: 'Temperature',
        onColor: 'bad',
        order: 1
      }
    },
    '/Leds/LowBattery': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.leds.lowBattery`)
      },
      meta: {
        displayName: 'Low Battery',
        onColor: 'bad',
        order: 2
      }
    },
    '/Leds/Overload': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.leds.overload`)
      },
      meta: {
        displayName: 'Overload',
        onColor: 'bad',
        order: 3
      }
    },
    '/Leds/Inverter': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.leds.inverter`)
      },
      meta: {
        displayName: 'Inverter',
        order: 4
      }
    },
    '/Leds/Float': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.leds.float`)
      },
      meta: {
        displayName: 'Float',
        order: 5
      }
    },
    '/Leds/Bulk': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.leds.bulk`)
      },
      meta: {
        displayName: 'Bulk',
        order: 6
      }
    },
    '/Leds/Absorption': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.leds.absorption`)
      },
      meta: {
        displayName: 'Absorption',
        order: 7
      }
    },
    '/Leds/Mains': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.leds.mains`)
      },
      meta: {
        displayName: 'Mains',
        order: 8
      }
    },
    '/State': [
      {
        path: (m) => {
          return makePath(m, `${m.instanceName}.${getStatePropName(m)}`)
        },
        conversion: convertState
      },
      {
        path: (m) => {
          const propName = getStatePropName(m)
          if (propName) {
            return makePath(m, `${m.instanceName}.${propName}Number`)
          }
        }
      },

      // this is so that we put out a inverter.inverterMode value for vebus types
      {
        path: (m) => {
          return makePath(m, `${m.instanceName}.inverterMode`, true)
        },
        conversion: (msg) => {
          return isVEBus(msg) ? convertState(msg) : null
        }
      },
      {
        path: (m) => {
          return makePath(m, `${m.instanceName}.inverterModeNumber`, true)
        },
        conversion: (msg) => {
          return isVEBus(msg) ? msg.value : null
        }
      }
    ],
    '/Devices/0/ExtendStatus/PreferRenewableEnergy': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.preferRenewableEnergy`, true)
      }
    },
    '/Devices/0/ExtendStatus/PreferRenewableEnergyActive': {
      path: (m) => {
        return makePath(
          m,
          `${m.instanceName}.preferRenewableEnergyActive`,
          true
        )
      }
    },
    'Devices/0/ExtendStatus/SustainMode': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.sustainMode`, true)
      }
    },
    '/Mode': [
      {
        path: (m) => {
          return makePath(m, `${m.instanceName}.mode`)
        },
        conversion: convertMode,
        putSupport: (m: Message) => {
          if (m.senderName.startsWith('com.victronenergy.vebus')) {
            return {
              conversion: convertVeBusModeString,
              confirmChange: (value: any, input: any) => {
                return convertVeBusMode(input) === value
              }
            }
          }
        },
        meta: (m: Message) => {
          if (m.senderName.startsWith('com.victronenergy.vebus')) {
            return modeMeta
          }
        }
      },
      {
        path: (m) => {
          return makePath(m, `${m.instanceName}.modeNumber`)
        },
        putSupport: (_m) => {
          return {}
        },
        meta: (m: Message) => {
          if (m.senderName.startsWith('com.victronenergy.vebus')) {
            return modeNumberMeta
          }
        }
      },
      {
        path: (m) => {
          return m.senderName.startsWith('com.victronenergy.solarcharger')
            ? makePath(m, `${m.instanceName}.modeSwitch.state`)
            : undefined
        },
        conversion: (m) => {
          return m.value === 1 ? 1 : 0
        },
        putSupport: (_m) => {
          return {
            conversion: (value: any) => {
              return value === 1 || value === 'on' ? 1 : 0
            }
          }
        },
        meta: {
          displayName: 'Solar Enabled'
        }
      }
    ],
    '/ErrorCode': {
      path: (m) => {
        return 'notifications.' + makePath(m, `${m.instanceName}.error`)
      },
      conversion: (m, path) => convertErrorToNotification(app, m, path)
    },
    '/Capacity': {
      path: (m) => {
        return typeof m.fluidType === 'undefined'
          ? undefined
          : 'tanks.' + getFluidType(m.fluidType) + `.${m.instanceName}.capacity`
      }
    },
    '/Remaining': {
      path: (m) => {
        return typeof m.fluidType === 'undefined'
          ? undefined
          : 'tanks.' +
              getFluidType(m.fluidType) +
              `.${m.instanceName}.remaining`
      },
      units: 'm3'
    },
    '/Level': {
      path: (m) => {
        return typeof m.fluidType === 'undefined'
          ? undefined
          : 'tanks.' +
              getFluidType(m.fluidType) +
              `.${m.instanceName}.currentLevel`
      },
      conversion: percentToRatio,
      units: 'ratio'
    },
    '/Temperature': {
      path: (m) => {
        return typeof m.temperatureType === 'undefined'
          ? undefined
          : getTemperaturePath(m, options)
      },
      conversion: celsiusToKelvin,
      units: 'K'
    },
    '/Humidity': {
      path: (m) => {
        return typeof m.temperatureType === 'undefined'
          ? undefined
          : getTemperaturePath(m, options, 'humidity')
      },
      conversion: percentToRatio,
      units: 'ratio'
    },
    '/Pressure': {
      path: (m) => {
        return typeof m.temperatureType === 'undefined'
          ? undefined
          : getTemperaturePath(m, options, 'pressure')
      },
      conversion: (msg) => {
        return msg.value * 100 // hPa -> Pa
      },
      units: 'Pa'
    },
    '/AccelX': {
      path: (m) => {
        return typeof m.temperatureType === 'undefined'
          ? undefined
          : getTemperaturePath(m, options, 'accelerationX')
      },
      units: 'g'
    },
    '/AccelY': {
      path: (m) => {
        return typeof m.temperatureType === 'undefined'
          ? undefined
          : getTemperaturePath(m, options, 'accelerationY')
      },
      units: 'g'
    },
    '/AccelZ': {
      path: (m) => {
        return typeof m.temperatureType === 'undefined'
          ? undefined
          : getTemperaturePath(m, options, 'accelerationZ')
      },
      units: 'g'
    },
    '/BatteryVoltage': {
      path: (m) => {
        return typeof m.temperatureType === 'undefined'
          ? undefined
          : getTemperaturePath(m, options, 'voltage')
      },
      units: 'V'
    },
    '/Status': [
      {
        path: (m) => {
          return typeof m.temperatureType === 'undefined'
            ? undefined
            : getTemperaturePath(m, options, 'status')
        },
        conversion: convertRuuivStatus
      },
      {
        path: (m) => {
          return typeof m.temperatureType === 'undefined'
            ? undefined
            : getTemperaturePath(m, options, 'statusNumber')
        }
      }
    ],
    '/Ac/Current': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.current`, true)
      },
      units: 'A'
    },
    '/Ac/Power': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.power`, true)
      },
      units: 'W'
    },
    '/Ac/Voltage': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/Energy/Forward': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.energy.forward`, true)
      }
    },
    '/Ac/Energy/Reverse': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.energy.reverse`, true)
      }
    },

    '/Ac/L1/Current': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l1.current`, true)
      },
      units: 'A'
    },
    '/Ac/L1/Power': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l1.power`, true)
      },
      units: 'W'
    },
    '/Ac/L1/Voltage': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l1.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/L1/Energy/Forward': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l1.energy.forward`, true)
      }
    },
    '/Ac/L1/Energy/Reverse': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l1.energy.reverse`, true)
      }
    },

    '/Ac/L3/Current': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l3.current`, true)
      },
      units: 'A'
    },
    '/Ac/L3/Power': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l3.power`, true)
      },
      units: 'W'
    },
    '/Ac/L3/Voltage': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l3.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/L3/Energy/Forward': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l3.energy.forward`, true)
      }
    },
    '/Ac/L3/Energy/Reverse': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l3.energy.reverse`, true)
      }
    },

    '/Ac/L2/Current': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l2.current`, true)
      },
      units: 'A'
    },
    '/Ac/L2/Power': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l2.power`, true)
      },
      units: 'W'
    },
    '/Ac/L2/Voltage': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l2.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/L2/Energy/Forward': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l2.energy.forward`, true)
      }
    },
    '/Ac/L2/Energy/Reverse': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.l2.energy.reverse`, true)
      }
    },

    '/Ac/ActiveIn/Source': [
      {
        path: (m) => {
          return `electrical.${m.venusName}.acSource`
        },
        conversion: convertSource,
        requiresInstance: false
      },
      {
        path: (m) => {
          return `electrical.${m.venusName}.acSourceNumber`
        },
        requiresInstance: false
      },
      {
        path: (m) => {
          return makePath(m, `${m.instanceName}.acin.acSource`, true)
        },
        conversion: convertSource
      },
      {
        path: (m) => {
          return makePath(m, `${m.instanceName}.acin.acSourceNumber`, true)
        }
      }
    ],
    '/Ac/ActiveIn/CurrentLimit': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin.currentLimit`, true)
      },
      units: 'A',
      putSupport: (_m) => {
        return {}
      }
    },
    '/Ac/In/L1/I': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin.1.current`, true)
      },
      units: 'A'
    },
    '/Ac/In/L2/I': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin.2.current`, true)
      },
      units: 'A'
    },
    '/Ac/In/1/CurrentLimit': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin.1.currentLimit`, true)
      },
      units: 'A',
      putSupport: (_m) => {
        return {}
      }
    },
    '/Ac/In/2/CurrentLimit': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin.2.currentLimit`, true)
      },
      units: 'A',
      putSupport: (_m) => {
        return {}
      }
    },
    '/Ac/State/IgnoreAcIn1': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acState.ignoreAcIn1.state`, true)
      },
      putSupport: (_m) => {
        return {
          putPath: (_m: Message) => '/Ac/Control/IgnoreAcIn1'
        }
      }
    },
    '/Ac/State/AcIn1Available': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acState.acIn1Available`, true)
      }
    },
    '/Ac/ActiveIn/L1/I': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin.current`, true)
      },
      units: 'A'
    },
    '/Ac/ActiveIn/L1/P': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin.power`, true)
      },
      units: 'W'
    },
    '/Ac/ActiveIn/L1/V': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/ActiveIn/L1/F': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin.frequency`, true)
      },
      units: 'Hz'
    },
    '/Ac/ActiveIn/L2/I': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin2.current`, true)
      },
      units: 'A'
    },
    '/Ac/ActiveIn/L2/P': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin2.power`, true)
      },
      units: 'W'
    },
    '/Ac/ActiveIn/L2/V': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin2.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/ActiveIn/L3/I': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin3.current`, true)
      },
      units: 'A'
    },
    '/Ac/ActiveIn/L3/P': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin3.power`, true)
      },
      units: 'W'
    },
    '/Ac/ActiveIn/L3/V': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acin3.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/Out/L1/I': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acout.current`, true)
      },
      units: 'A'
    },
    '/Ac/Out/L1/P': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acout.power`, true)
      },
      units: 'W'
    },
    '/Ac/Out/L1/V': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acout.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/Out/L1/F': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acout.frequency`, true)
      },
      units: 'Hz'
    },
    '/Ac/Out/L2/I': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acout2.current`, true)
      },
      units: 'A'
    },
    '/Ac/Out/L2/P': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acout2.power`, true)
      },
      units: 'W'
    },
    '/Ac/Out/L2/V': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acout2.voltage`, true)
      },
      units: 'V'
    },
    '/Ac/Out/L3/I': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acout3.current`, true)
      },
      units: 'A'
    },
    '/Ac/Out/L3/P': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acout3.power`, true)
      },
      units: 'W'
    },
    '/Ac/Out/L3/V': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.acout3.voltage`, true)
      },
      units: 'V'
    },
    '/Relay/0/State': {
      path: (m) => {
        if (m.senderName.startsWith('com.victronenergy.system')) {
          return (
            (options.relayPath0 || 'electrical.switches.venus-0') + '.state'
          )
        } else {
          return makePath(m, `${m.instanceName}.relay.state`, true)
        }
      },
      putSupport: (_m) => {
        return {
          conversion: (value: any) => {
            return value === 1 || value == true || value === 'on' ? 1 : 0
          }
        }
      },
      requiresInstance: false
    },
    '/Relay/1/State': {
      path: (options.relayPath1 || 'electrical.switches.venus-1') + '.state',
      putSupport: (_m) => {
        return {
          conversion: (value: any) => {
            return value === 1 || value == true || value === 'on' ? 1 : 0
          }
        }
      },
      requiresInstance: false
    },
    '/Dc/System/Power': {
      path: (m) => {
        return `electrical.${m.venusName}.dcPower`
      },
      requiresInstance: false,
      units: 'W'
    },
    '/Dc/Vebus/Power': {
      path: (m) => {
        return `electrical.${m.venusName}.vebusDcPower`
      },
      requiresInstance: false,
      units: 'W'
    },
    '/Dc/Pv/Current': {
      path: (m) => {
        return `electrical.${m.venusName}.totalPanelCurrent`
      },
      requiresInstance: false,
      units: 'A'
    },
    '/Dc/Pv/Power': {
      path: (m) => {
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
      path: (m) => {
        if (m.senderName.startsWith('com.victronenergy.gps')) {
          return 'navigation.speedOverGround'
        } else {
          return makePath(m, `${m.instanceName}.speed`)
        }
      },
      requiresInstance: false
    },
    '/Position/Latitude': {
      path: 'navigation.position',
      requiresInstance: false,
      conversion: (msg) => {
        state.lastLat = msg.value
        if (
          state.lastLon &&
          (options.usePosition === undefined || options.usePosition)
        ) {
          return {
            latitude: msg.value,
            longitude: state.lastLon,
            altitude: state.lastAltitude
          }
        }
      }
    },
    '/Position/Longitude': {
      path: 'navigation.position',
      requiresInstance: false,
      conversion: (msg) => {
        state.lastLon = msg.value
        if (
          state.lastLat &&
          (options.usePosition === undefined || options.usePosition)
        ) {
          return {
            latitude: state.lastLat,
            longitude: msg.value,
            altitude: state.lastAltitude
          }
        }
      }
    },
    '/Altitude': {
      path: 'navigation.position',
      requiresInstance: false,
      conversion: (msg) => {
        state.lastAltitude = msg.value
        if (
          state.lastLat &&
          state.lastLon &&
          (options.usePosition === undefined || options.usePosition)
        ) {
          return {
            latitude: state.lastLat,
            longitude: state.lastLon,
            altitude: state.lastAltitude
          }
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
        path: (m) => {
          return `electrical.${m.venusName}.state`
        },
        conversion: convertSystemState,
        requiresInstance: false
      },
      {
        path: (m) => {
          return `electrical.${m.venusName}.stateNumber`
        },
        requiresInstance: false
      }
    ],
    '/FieldDrive': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.fieldDrive`)
      },
      conversion: percentToRatio,
      units: 'ratio'
    },

    '/Bms/AllowToCharge': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.bms.allowToCharge`)
      },
      putSupport: (_m) => {
        return {
          conversion: (value: any) => {
            return value === 1 || value === true ? 1 : 0
          }
        }
      }
    },
    '/Bms/AllowToDischarge': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.bms.allowToDischarge`)
      },
      putSupport: (_m) => {
        return {
          conversion: (value: any) => {
            return value === 1 || value === true ? 1 : 0
          }
        }
      }
    },
    '/Bms/BmsExpected': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.bms.expected`)
      }
    },
    '/Bms/BmsType': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.bms.type`)
      }
    },
    '/Bms/Error': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.bms.error`)
      }
    },
    '/Bms/PreAlarm': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.bms.preAlarm`)
      }
    },
    '/Bms/AllowToChargeRate': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.bms.allowToChargeRate`)
      },
      putSupport: (_m) => {
        return {
          conversion: (value: any) => {
            return value === 1 || value === true ? 1 : 0
          }
        }
      }
    },
    '/Io/AllowToCharge': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.bms.allowToCharge`)
      },
      putSupport: (_m) => {
        return {
          conversion: (value: any) => {
            return value === 1 || value === true ? 1 : 0
          }
        }
      }
    },
    '/Io/AllowToDischarge': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.bms.allowToDischarge`)
      },
      putSupport: (_m) => {
        return {
          conversion: (value: any) => {
            return value === 1 || value === true ? 1 : 0
          }
        }
      }
    },
    '/Io/ExternalRelay': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.bms.externalRelay`)
      }
    },
    '/Balancing': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.bms.balancing`)
      }
    },
    '/RunningByConditionCode': [
      {
        path: (m) => {
          return makePath(m, `${m.instanceName}.runningByCondition`)
        },
        conversion: convertRunningByConditionCode
      },
      {
        path: (m) => {
          return makePath(m, `${m.instanceName}.runningByConditionCode`)
        }
      }
    ],
    '/Runtime': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.runtime`)
      },
      units: 's'
    },
    '/TodayRuntime': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.todayRuntime`)
      },
      units: 's'
    },
    '/ManualStart': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.manualStart`)
      },
      conversion: (msg) => {
        return msg.value == 1 ? true : false
      },
      putSupport: (_m) => {
        return {
          conversion: (value: any) => {
            return value === 1 || value === true ? 1 : 0
          }
        }
      },
      units: 'bool'
    },
    '/ManualStartTimer': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.manualStartTimer`)
      },
      putSupport: (_m) => {
        return {}
      },
      units: 's'
    },
    '/QuietHours': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.quietHours`)
      },
      conversion: (msg) => {
        return msg.value == 1 ? true : false
      },
      units: 'bool'
    },
    '/AutoStartEnabled': {
      path: (m) => {
        return makePath(m, `${m.instanceName}.autoStartEnabled`)
      },
      conversion: (msg) => {
        return msg.value == 1 ? true : false
      },
      putSupport: (_m) => {
        return {
          conversion: (value: any) => {
            return value === 1 || value === true ? 1 : 0
          }
        }
      },
      units: 'bool'
    }
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
}

export const getDIMappings = (
  _app: any,
  _options: any
): VenusToSignalKMappings => {
  return {
    '/Count': {
      path: (m) => {
        return `electrical.venus-input.${m.instanceName}.count`
      }
    },
    '/State': [
      {
        path: (m) => {
          return `electrical.venus-input.${m.instanceName}.state`
        },
        conversion: mapInputState
      },
      {
        path: (m) => {
          return `electrical.venus-input.${m.instanceName}.stateNumber`
        }
      }
    ],
    '/InputState': {
      path: (m) => {
        return `electrical.venus-input.${m.instanceName}.inputState`
      }
    },
    '/ProductName': {
      path: (m) => {
        return `electrical.venus-input.${m.instanceName}.productName`
      }
    },
    '/Connected': {
      path: (m) => {
        return `electrical.venus-input.${m.instanceName}.connected`
      }
    },
    '/Type': {
      path: (m) => {
        return `electrical.venus-input.${m.instanceName}.type`
      }
    },
    '/CustomName': {
      path: (m) => {
        return `electrical.venus-input.${m.instanceName}.customName`
      }
    }
  }
}
