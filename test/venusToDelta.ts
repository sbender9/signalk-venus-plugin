import { expect, assert } from 'chai'
import fs from 'fs'
import readline from 'readline';
import { VenusToSignalK } from '../src/venusToDeltas'
import { ServerAPI } from '@signalk/server-api'
import { Message } from '../src/venusToDeltas'

const files = ['./test/mqtt-data.log', './test/dbus-test.log', './test/vrm-test.log']

files.forEach((file) => {
  describe(`to delta from file ${file}`, async () => {

    const vsk = new VenusToSignalK(      
      { 
        getSelfPath: (mat:string) => undefined,
      } as ServerAPI,
      {},
      {},
      (
        path: string,
        m: Message,
        converter: (input: any) => any,
        confirmChange: (oldValue: any, newValue: any) => boolean,
        putPath: string
      ) => {/*
        app.registerActionHandler(
          'vessels.self',
          path,
          getActionHandler(m, converter, confirmChange, putPath)
        )*/
      }
    )

    const content: string = fs.readFileSync(file, 'utf-8');
    const lines: string[] = content.split(/\r?\n/);

    lines.forEach((line) => {
      const data = JSON.parse(line)
      //if ( data.deltas.length > 0 ) {
        it(`${data.message.senderName}:${data.message.path}`,  (done) => {
          const deltas = vsk.toDelta(data.message)
          expect(deltas).to.deep.equal(data.deltas)
          done()
        })
      //}
    })
  })
})
