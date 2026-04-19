import { expect } from 'chai'
import fs from 'fs'
//import readline from 'readline'
import { VenusToSignalK } from '../src/venusToDeltas'
import { ServerAPI } from '@signalk/server-api'
import { Message } from '../src/venusToDeltas'
import { PutConfirmChange, PutConversion } from '../src/mappings'

const files = [
  /*
  {
    name: 'mqtt',
    file: './test/mqtt-test.log',
    puts: [
      'electrical.switches.venus-1.state',
      'electrical.switches.venus-0.state',
      'electrical.chargers.257.bms.allowToCharge',
      'electrical.chargers.257.bms.allowToChargeRate',
      'electrical.chargers.257.bms.allowToDischarge',
      'electrical.chargers.257.mode',
      'electrical.chargers.257.modeNumber',
      'electrical.inverters.257.acin.currentLimit',
      'electrical.inverters.257.acin.1.currentLimit',
      'electrical.batteries.256.relay.state',
      'electrical.batteries.258.relay.state'
    ]
  },*/
  {
    name: 'dbus',
    file: './test/dbus-test.log',
    puts: [
      'electrical.inverters.257.acin.1.currentLimit',
      'electrical.chargers.257.bms.allowToDischarge',
      'electrical.inverters.257.acin.currentLimit',
      'electrical.chargers.257.mode',
      'electrical.chargers.257.modeNumber',
      'electrical.chargers.257.bms.allowToChargeRate',
      'electrical.chargers.257.bms.allowToCharge',
      'electrical.batteries.256.relay.state',
      'electrical.batteries.258.relay.state',
      'electrical.switches.venus-0.state',
      'electrical.switches.venus-1.state'
    ]
  },
  {
    name: 'vrm',
    file: './test/vrm-test.log',
    puts: [
      'electrical.batteries.289.relay.state',
      'electrical.solar.288.modeNumber',
      'electrical.solar.288.modeSwitch.state',
      'electrical.chargers.274.mode',
      'electrical.chargers.274.modeNumber',
      'electrical.inverters.274.acin.currentLimit',
      'electrical.inverters.274.acin.1.currentLimit',
      'electrical.inverters.274.acState.ignoreAcIn1.state',
      'electrical.switches.venus-1.state',
      'electrical.switches.venus-0.state'
    ]
  }
]

files.forEach((item) => {
  //console.log(`to delta from file ${item.file}`)

  const putRegistrations: string[] = []

  describe(`to delta from file ${item.file}`, async () => {
    const reportFile = `./test/${item.name}.missing.report`
    fs.rmSync(reportFile, { force: true })
    const vsk = new VenusToSignalK(
      {
        getSelfPath: (_path: string) => undefined
      } as ServerAPI,
      {},
      {},
      (
        path: string,
        _m: Message,
        _converter: PutConversion | undefined,
        _confirmChange: PutConfirmChange | undefined,
        _putPath: string | undefined
      ) => {
        console.log(`got put registration ${path}`)
        putRegistrations.push(path)
      }
    )

    const content: string = fs.readFileSync(item.file, 'utf-8')
    const lines: string[] = content.split(/\r?\n/)

    lines.forEach((line, index) => {
      //console.log(`input ${line}`)
      if (line.trim() === '') {
        return
      }
      try {
        const data = JSON.parse(line)

        if (data.deltas.length === 0) {
          fs.appendFileSync(reportFile, `${JSON.stringify(data.message)}\n`)
        }

        it(`${data.message.senderName}:${data.message.path} line ${index + 1}`, (done) => {
          try {
            const deltas = vsk.toDelta(data.message)
            expect(deltas).to.deep.equal(data.deltas)
            done()
          } catch (error) {
            done(error)
          }
        })
      } catch (error) {
        console.error(
          `Error parsing line ${item.file}:${index + 1}: ${line}`,
          error
        )
      }
    })
  })

  describe(`put registrations for ${item.file}`, async () => {
    it(`works`, () => {
      /*
      console.log(
        `put registrations for ${item.file}: ${JSON.stringify(putRegistrations)}`
      )
      */
      expect(putRegistrations).to.deep.members(item.puts)
    })
  })
})

describe('customMappings', () => {
  it('maps an exact Venus path to a system-level Signal K path', () => {
    const vsk = new VenusToSignalK(
      {
        getSelfPath: (_path: string) => undefined
      } as ServerAPI,
      {
        customMappings: [
          {
            venusPath: '/Settings/SystemSetup/MaxChargeCurrent',
            signalkPath: 'electrical.${venusName}.maxChargeCurrent',
            units: 'A'
          }
        ]
      },
      {},
      () => undefined
    )

    const deltas = vsk.toDelta({
      path: '/Settings/SystemSetup/MaxChargeCurrent',
      instanceName: '0',
      senderName: 'com.victronenergy.settings.0',
      venusName: 'venus',
      value: 0
    })

    expect(deltas).to.deep.equal([
      {
        updates: [
          {
            meta: [
              {
                path: 'electrical.venus.maxChargeCurrent',
                value: { units: 'A' }
              }
            ]
          }
        ]
      },
      {
        updates: [
          {
            $source: 'venus.com.victronenergy.settings.0',
            values: [
              {
                path: 'electrical.venus.maxChargeCurrent',
                value: 0
              }
            ]
          }
        ]
      }
    ])
  })

  it('maps a regex Venus path to wildcard VE.Bus charger paths', () => {
    const vsk = new VenusToSignalK(
      {
        getSelfPath: (_path: string) => undefined
      } as ServerAPI,
      {
        customMappings: [
          {
            venusPath: '^/Dc/0/MaxChargeCurrent$',
            venusPathIsRegex: true,
            dbusService: 'com.victronenergy.vebus',
            dbusServiceMatchMode: 'prefix',
            signalkPath: 'electrical.chargers.${instanceName}.maxChargeCurrent',
            units: 'A'
          }
        ]
      },
      {},
      () => undefined
    )

    const first = vsk.toDelta({
      path: '/Dc/0/MaxChargeCurrent',
      instanceName: '276',
      senderName: 'com.victronenergy.vebus.276',
      venusName: 'venus',
      value: 240
    })

    const second = vsk.toDelta({
      path: '/Dc/0/MaxChargeCurrent',
      instanceName: '288',
      senderName: 'com.victronenergy.vebus.288',
      venusName: 'venus',
      value: 240
    })

    expect(first).to.deep.equal([
      {
        updates: [
          {
            meta: [
              {
                path: 'electrical.chargers.276.maxChargeCurrent',
                value: { units: 'A' }
              }
            ]
          }
        ]
      },
      {
        updates: [
          {
            $source: 'venus.com.victronenergy.vebus.276',
            values: [
              {
                path: 'electrical.chargers.276.maxChargeCurrent',
                value: 240
              }
            ]
          }
        ]
      }
    ])

    expect(second).to.deep.equal([
      {
        updates: [
          {
            meta: [
              {
                path: 'electrical.chargers.288.maxChargeCurrent',
                value: { units: 'A' }
              }
            ]
          }
        ]
      },
      {
        updates: [
          {
            $source: 'venus.com.victronenergy.vebus.288',
            values: [
              {
                path: 'electrical.chargers.288.maxChargeCurrent',
                value: 240
              }
            ]
          }
        ]
      }
    ])
  })

  it('respects sender filters for custom mappings', () => {
    const vsk = new VenusToSignalK(
      {
        getSelfPath: (_path: string) => undefined
      } as ServerAPI,
      {
        customMappings: [
          {
            venusPath: '^/Dc/0/MaxChargeCurrent$',
            venusPathIsRegex: true,
            dbusService: 'com.victronenergy.vebus',
            dbusServiceMatchMode: 'prefix',
            signalkPath: 'electrical.chargers.${instanceName}.maxChargeCurrent',
            units: 'A'
          }
        ]
      },
      {},
      () => undefined
    )

    const deltas = vsk.toDelta({
      path: '/Dc/0/MaxChargeCurrent',
      instanceName: '512',
      senderName: 'com.victronenergy.battery.512',
      venusName: 'venus',
      value: 99
    })

    expect(deltas).to.deep.equal([])
  })
})
