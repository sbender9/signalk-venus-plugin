/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai'
import fs from 'fs'
//import readline from 'readline'
import { VenusToSignalK } from '../src/venusToDeltas'
import { ServerAPI } from '@signalk/server-api'
import { Message } from '../src/venusToDeltas'

const files = [
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
  },
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
        _confirmChange: (oldValue: any, newValue: any) => boolean,
        _putPath: string
      ) => {
        putRegistrations.push(path)
      }
    )

    const content: string = fs.readFileSync(item.file, 'utf-8')
    const lines: string[] = content.split(/\r?\n/)

    lines.forEach((line) => {
      //console.log(`input ${line}`)
      const data = JSON.parse(line)

      if (data.deltas.length === 0) {
        fs.appendFileSync(
          reportFile,
          `${JSON.stringify(data.message)}\n`
        )
      }

      it(`${data.message.senderName}:${data.message.path}`, (done) => {
        try {
          const deltas = vsk.toDelta(data.message)
          expect(deltas).to.deep.equal(data.deltas)
          done()
        } catch (error) {
          done(error)
        }
      })
      //}
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
