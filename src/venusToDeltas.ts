/* eslint-disable @typescript-eslint/no-explicit-any */

import Debug from 'debug'
import { ServerAPI, Delta, SourceRef, Path } from '@signalk/server-api'
import fs from 'fs'

import {
  getMappings,
  getDIMappings,
  VenusToSignalKMappings,
  VenusToSignalKMapping,
  PutConversion,
  PutConfirmChange
} from './mappings'

const debug = Debug('signalk-venus-plugin:venusToDeltas')

export type Message = {
  path: string
  venusName?: string
  instanceName: string
  senderName: string
  topic?: string
  value: any
  text?: string
  fluidType?: number
  temperatureType?: number
}

export class VenusToSignalK {
  private venusToSignalKMapping: VenusToSignalKMappings = {}
  private digitalInputsMappings: VenusToSignalKMappings = {}
  private makeTestLog: boolean = false
  private logged: string[] = []

  constructor(
    private app: ServerAPI,
    private options: any,
    private state: any,
    private putRegistrar: (
      path: string,
      m: Message,
      converter: PutConversion | undefined,
      confirmChange: PutConfirmChange | undefined,
      putPath: string | undefined
    ) => void
  ) {
    state.knownPaths = []
    state.knownSenders = []
    state.sentModeMeta = false
    state.loggedUnknowns = []

    for (const [key, value] of Object.entries(
      getMappings(app, options, state)
    )) {
      this.venusToSignalKMapping[key] = !Array.isArray(value) ? [value] : value
    }
    for (const [key, value] of Object.entries(getDIMappings(app, options))) {
      this.digitalInputsMappings[key] = !Array.isArray(value) ? [value] : value
    }
  }

  toDelta(m: Message): Delta[] {
    const deltas: Delta[] = []

    debug('%j', m)

    if (!m.senderName) {
      return deltas
    }

    if (m.senderName && this.state.knownSenders.indexOf(m.senderName) == -1) {
      this.state.knownSenders.push(m.senderName)
    }

    if (
      this.options.ignoredSenders &&
      this.options.ignoredSenders.indexOf(m.senderName) != -1
    ) {
      return deltas
    }

    if (m.path.startsWith('/Alarms')) {
      const delta = this.getAlarmDelta(m)
      if (delta) {
        deltas.push(delta)
      }
      this.logTestMessage(m, deltas)
      return deltas
    }

    let mappings: VenusToSignalKMapping[]

    if (m.senderName.startsWith('com.victronenergy.digitalinput')) {
      mappings = (
        this.digitalInputsMappings[m.path]
          ? this.digitalInputsMappings[m.path]
          : []
      ) as VenusToSignalKMapping[]
    } else {
      mappings = (this.venusToSignalKMapping[m.path] ||
        []) as VenusToSignalKMapping[]
    }

    /*
      if ( mappings.length === 0 && state.loggedUnknowns.indexOf(m.path) == -1) {
        console.log(JSON.stringify(m))
        state.loggedUnknowns.push(m.path)
        }
      */

    if (m.venusName === undefined) {
      m.venusName = 'venus'
    }

    mappings.forEach((mapping) => {
      let theValue = m.value

      if (
        (mapping.requiresInstance === undefined || mapping.requiresInstance) &&
        m.instanceName === undefined
      ) {
        debug(`mapping: skipping: ${m.senderName} ${mapping.requiresInstance}`)
        return
      }

      const thePath =
        typeof mapping.path === 'function' ? mapping.path(m) : mapping.path

      if (thePath === undefined) {
        return
      }

      if (mapping.conversion && !Array.isArray(theValue) && theValue != null) {
        theValue = mapping.conversion(m, thePath, false)
      }

      if (Array.isArray(theValue)) {
        // seem to get this for unknown values
        theValue = null
      }

      if (
        !mapping.sendNulls &&
        (theValue === undefined || theValue === null) &&
        this.state.knownPaths.indexOf(thePath) === -1
      ) {
        debug('mapping: no value')
        return
      }

      if (thePath !== undefined && theValue !== undefined) {
        if (this.state.knownPaths.indexOf(thePath) == -1) {
          this.state.knownPaths.push(thePath)
          if (this.app) {
            let meta: any = {}
            if (mapping.units) {
              meta.units = mapping.units
            }

            if (mapping.meta) {
              const mappingMeta =
                typeof mapping.meta === 'function'
                  ? mapping.meta(m)
                  : mapping.meta
              if (mappingMeta) {
                meta = { ...meta, ...mappingMeta }
              }
            }

            if (Object.keys(meta).length > 0) {
              const delta: Delta = {
                updates: [
                  {
                    meta: [{ path: thePath as Path, value: meta }]
                  }
                ]
              }
              deltas.push(delta)
            }
          }

          const putSupport = mapping.putSupport && mapping.putSupport(m)
          if (putSupport && this.putRegistrar) {
            let putPath
            if (putSupport.putPath) {
              putPath = putSupport.putPath(m)
            }
            this.putRegistrar(
              thePath,
              m,
              putSupport.conversion,
              putSupport.confirmChange,
              putPath
            )
          }
        }
        if (
          !this.options.blacklist ||
          this.options.blacklist.indexOf(thePath) == -1
        ) {
          const delta = makeDelta(this.app, m, thePath, theValue)

          deltas.push(delta)
        }
      }
    })

    debug(`produced ${deltas.length} deltas`)
    this.logTestMessage(m, deltas)
    return deltas
  }

  getKnownPaths() {
    return this.state.knownPaths
  }

  getKnownSenders() {
    return this.state.knownSenders
  }

  hasCustomName(service: string) {
    return servicesWithCustomNames.indexOf(service) != -1
  }

  private getAlarmDelta(msg: Message) {
    if (msg.senderName.startsWith('com.victronenergy.tank')) {
      //ignore for now
      return
    }

    let name = msg.path.substring(1).replace(/\//g, '.') // alarms.LowVoltage
    name = name.substring(name.indexOf('.') + 1) // LowVoltate
    name = name.charAt(0).toLowerCase() + name.substring(1) // lowVoltate

    let path = makePath(msg, `${msg.instanceName}.${name}`)
    if (!path) {
      path = `electrical.venus.${msg.instanceName}.${name}`
    }
    const npath = 'notifications.' + path
    const value = this.convertAlarmToNotification(msg, npath)
    return value ? makeDelta(this.app, msg, npath, value) : null
  }

  private convertAlarmToNotification(m: Message, path: string) {
    let value
    let message

    if (!this.app || !this.app.getSelfPath) {
      return
    }

    if (typeof m.value === 'string') {
      message = m.value
    } else {
      message = m.path.split('/')[2]
    }
    const existing = this.app.getSelfPath(path)
    if (m.value == null || m.value == 0) {
      if (existing && existing.value && existing.value.state !== 'normal') {
        value = { state: 'normal', message: message }
      }
    } else {
      let method = ['visual', 'sound']
      if (existing && existing.value) {
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

  private logTestMessage(message: Message, deltas: any[]) {
    if (
      this.makeTestLog &&
      this.logged.indexOf(message.senderName + message.path) === -1
    ) {
      this.logged.push(message.senderName + message.path)
      const log = {
        message: message,
        deltas: deltas
      }
      fs.appendFileSync(
        '/tmp/signalk-venus-test.log',
        JSON.stringify(log) + '\n'
      )
    }
  }
}

export function convertErrorToNotification(
  app: ServerAPI,
  m: Message,
  path: string
) {
  let value

  const existing = app.getSelfPath(path)

  if (m.value == 0) {
    if (existing && existing.value && existing.value.state !== 'normal') {
      value = { state: 'normal', message: 'No Error' }
    }
  } else {
    let msg
    if (m.senderName.startsWith('com.victronenergy.solarcharger')) {
      msg = solarErrorCodeMap[m.value]
    }

    if (!msg) {
      msg = `Unknown Error ${m.value}: ${m.text}`
    }

    let method = ['visual', 'sound']
    if (existing && existing.value) {
      method = existing.value.method
    }

    value = {
      state: 'alarm',
      message: msg,
      method
    }
  }

  return value
}

export function percentToRatio(msg: Message) {
  return msg.value / 100.0
}

const stateMaps: { [key: string]: { [key: number]: string } } = {
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
    252: 'external control'
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

  'com.victronenergy.generator': {
    0: 'stopped',
    1: 'running',
    2: 'warm uo',
    3: 'cool down',
    4: 'stopping',
    10: 'error'
  }
}

const systemStateMap: { [key: number]: string } = {
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

const mppOperationModeMap: { [key: number]: string } = {
  0: 'off',
  1: 'voltage/current limited',
  2: 'mppt active',
  255: 'not available'
}

function senderNamePrefix(senderName: string) {
  return senderName.substring(0, senderName.lastIndexOf('.'))
}

export function isVEBus(msg: Message) {
  return senderNamePrefix(msg.senderName) === 'com.victronenergy.vebus'
}

export function convertSystemState(msg: Message) {
  return systemStateMap[Number(msg.value)] || String(msg.value)
}
export function convertMppOperationMode(msg: Message) {
  return mppOperationModeMap[Number(msg.value)] || String(msg.value)
}

export function convertState(
  msg: Message,
  _path?: string,
  _forInverter?: boolean
) {
  const map = stateMaps[senderNamePrefix(msg.senderName)]
  return (map && map[Number(msg.value)]) || String(msg.value)
}

/*
function convertStateForVEBusInverter(msg: Message) {
return convertState(msg, undefined, true)
}
*/

const convertRunningByConditionMap: { [key: number]: string } = {
  0: 'stopped',
  1: 'manual',
  2: 'test run',
  3: 'loss of communication',
  4: 'soc',
  5: 'acload',
  6: 'battery current',
  7: 'battery voltage',
  8: 'inverter high temp',
  9: 'inverter overload'
}

export function convertRunningByConditionCode(msg: Message) {
  return convertRunningByConditionMap[msg.value] || String(msg.value)
}

const convertRuuivStatusMap: { [key: number]: string } = {
  0: 'ok',
  1: 'disconnected',
  2: 'short circuited',
  3: 'reverse polarity',
  4: 'unknown'
}

export function convertRuuivStatus(msg: Message) {
  return convertRuuivStatusMap[msg.value] || String(msg.value)
}

const servicesWithCustomNames: string[] = [
  'com.victronenergy.battery',
  'com.victronenergy.dcload',
  'com.victronenergy.solarcharger',
  'com.victronenergy.inverter',
  'com.victronenergy.vebus',
  'com.victronenergy.digitalinput'
]

const modeMaps: { [key: string]: { [key: number]: string } } = {
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

const statePropName: { [key: string]: string } = {
  'com.victronenergy.vebus': 'chargingMode',
  'com.victronenergy.charger': 'chargingMode',
  'com.victronenergy.solarcharger': 'controllerMode',
  'com.victronenergy.inverter': 'inverterMode',
  'com.victronenergy.battery': 'mode',
  'com.victronenergy.alternator': 'chargingMode',
  'com.victronenergy.dcdc': 'chargingMode',
  'com.victronenergy.system': 'state'
}

export function getStatePropName(msg: Message) {
  return statePropName[senderNamePrefix(msg.senderName)] || 'state'
}

export function convertVeBusModeString(value: string) {
  const map = modeMaps['com.victronenergy.vebus']
  const entry = Object.entries(map).find((entry) => {
    return entry[1] === value
  })
  return entry !== undefined ? Number(entry[0]) : undefined
}

export function convertVeBusMode(value: any) {
  const modeMap = modeMaps['com.victronenergy.vebus']
  return (modeMap && modeMap[Number(value)]) || 'unknown'
}

export function convertMode(msg: Message) {
  const modeMap = modeMaps[senderNamePrefix(msg.senderName)]
  return (modeMap && modeMap[Number(msg.value)]) || 'unknown'
}

const acinSourceMap: { [key: number]: string } = {
  1: 'grid',
  2: 'genset',
  3: 'shore',
  240: 'battery'
}

export function convertSource(msg: Message) {
  return acinSourceMap[Number(msg.value)] || 'unknown'
}

const solarErrorCodeMap: { [key: number]: string } = {
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

export function kWhToJoules(m: Message) {
  return Number(m.value) * 3600000
}

export function ahToCoulomb(m: Message) {
  return Number(m.value) * 3600
}

export function celsiusToKelvin(m: Message) {
  return Number(m.value) + 273.15
}

export function degsToRad(m: Message) {
  return Number(m.value) * (Math.PI / 180.0)
}

const fluidTypeMapping: { [key: number]: string } = {
  0: 'fuel',
  1: 'freshWater',
  2: 'wasteWater',
  3: 'liveWell',
  4: 'lubrication',
  5: 'blackWater'
}

export function getFluidType(typeId: number) {
  return fluidTypeMapping[typeId] || 'unknown'
}

export function getTemperaturePath(
  m: Message,
  options: any,
  name = 'temperature'
) {
  if (options.temperatureMappings) {
    const mapping = options.temperatureMappings.find(
      (mapping: any) => mapping.venusId == m.instanceName
    )
    if (mapping) {
      let path = mapping.signalkPath
      if (name !== 'temperature') {
        const parts = path.split('.')
        path = parts.slice(0, parts.length - 1).join('.') + `.${name}`
      }
      return path
    }
  }

  if (m.temperatureType === 1) {
    return `environment.inside.refrigerator.${name}`
  } else {
    return `environment.venus.${m.instanceName}.${name}`
  }
}

const inputStateMapping: { [key: number]: string } = {
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

export function mapInputState(msg: Message) {
  return inputStateMapping[Number(msg.value)] || 'unknown'
}

function makeDelta(
  app: ServerAPI,
  m: Message,
  path: string,
  value: any
): Delta {
  const delta: Delta = {
    updates: [
      {
        $source: `venus.${m.senderName.replace(/\:/g, '')}` as SourceRef,
        values: [
          {
            path: path as Path,
            value: value
          }
        ]
      }
    ]
  }

  return delta
}

export const modeNumberMeta = {
  displayName: 'Inverter Mode Number',
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

export const modeMeta = {
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

export function makePath(
  msg: Message,
  path?: string,
  vebusIsInverterValue?: boolean
) {
  let type

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
    type =
      vebusIsInverterValue === undefined || vebusIsInverterValue === false
        ? 'chargers'
        : 'inverters'
  } else if (msg.senderName.startsWith('com.victronenergy.tank')) {
    type = 'tanks'
  } else if (
    msg.senderName.startsWith('com.victronenergy.system') ||
    msg.senderName.startsWith('com.victronenergy.settings')
  ) {
    type = msg.venusName
  } else {
    const parts = msg.senderName.split('.')
    if (parts.length > 2) {
      type = parts[2]
    } else {
      debug('no path for %s', msg.senderName)
      return undefined
    }
  }
  return 'electrical.' + type + '.' + (path || '')
}
