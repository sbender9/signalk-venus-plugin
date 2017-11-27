const assert = require('assert')
const venusToDeltas = require('../venustodeltas')
const expect = require('chai').expect

describe('venustodeltas', function () {
  describe('Battery Voltage', function () {
    it('should return voltage in normal case', function () {
      const deltas = venusToDeltas({
        serial: 177394,
        path: '/Dc/0/Voltage',
        interface: 'com.victronenergy.BusItem',
        member: 'PropertiesChanged',
        signature: 'a{sv}',
        sender: ':1.2',
        type: 4,
        flags: 1,
        body: [
          [
            [
              'Text',
              [
                [
                  {
                    type: 's',
                    child: []
                  }
                ],
                ['4459.1']
              ]
            ],
            [
              'Value',
              [
                [
                  {
                    type: 'd',
                    child: []
                  }
                ],
                [4459.099999998691]
              ]
            ]
          ]
        ],
        text: '4459.1',
        value: 4459.099999998691
      })

      expect(deltas.length).to.equal(1)
      expect(deltas[0]).to.nested.deep.include({
        'updates[0].values[0]': {
          path: 'electrical.batteries.1.voltage',
          value: 4459.099999998691
        }
      })
    })
  })
})
