var chai = require('chai')
const assert = require('assert')
const venusToDeltas = require('../venusToDeltas')
const expect = chai.expect
const signalkSchema = require('@signalk/signalk-schema')

chai.Should()
chai.use(require('chai-things'))
chai.use(signalkSchema.chaiModule)

function toFull(delta) {
  if (!delta.context) {
    delta.context = 'vessels.' + signalkSchema.fakeMmsiId
  }
  var contextParts = delta.context.split('.')
  var full = signalkSchema.deltaToFull(delta)
  return full[contextParts[0]][contextParts[1]]
}

describe('venustodeltas', function () {
  describe('Battery Voltage', function () {
    it('should return voltage in normal case', function () {
      const deltas = venusToDeltas([{
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
        value: 4459.099999998691,
        senderName: 'com.victronenergy.battery.ttyO0',
        instanceName: 0
      }])

      expect(deltas.length).to.equal(1)
      expect(deltas[0]).to.nested.deep.include({
        'updates[0].values[0]': {
          path: 'electrical.batteries.0.voltage',
          value: 4459.099999998691
        }
      })
      var tree = toFull(deltas[0])
      tree.should.be.validSignalKVesselIgnoringIdentity
    })
  })

  describe('Battery Current', function () {
    it('should return curent in normal case', function () {
      const deltas = venusToDeltas([{
        "serial": 22,
        "path": "/Dc/0/Current",
        "interface": "com.victronenergy.BusItem",
        "member": "PropertiesChanged",
        "signature": "a{sv}",
        "sender": ":1.50",
        "type": 4,
        "flags": 1,
        "body": [
          [
            [
              "Text",
              [
                [
                  {
                    "type": "s",
                    "child": []
                  }
                ],
                [
                  "-81.0A"
                ]
              ]
            ],
            [
              "Value",
              [
                [
                  {
                    "type": "d",
                    "child": []
                  }
                ],
                [
                  -81
                ]
              ]
            ]
          ]
        ],
        "text": "-81.0A",
        "value": -81,
        "senderName": 'com.victronenergy.battery.ttyO0',
        "instanceName": 0
      }])
      expect(deltas.length).to.equal(1)
      expect(deltas[0]).to.nested.deep.include({
        'updates[0].values[0]': {
          path: 'electrical.batteries.0.current',
          value: -81
        }
      })
      var tree = toFull(deltas[0])
      tree.should.be.validSignalKVesselIgnoringIdentity
    })
  })

  describe('Battery State Of Charge', function () {
    it('should return state of charge in normal case', function () {
      const deltas = venusToDeltas([{
        "serial": 20,
        "path": "/Soc",
        "interface": "com.victronenergy.BusItem",
        "member": "PropertiesChanged",
        "signature": "a{sv}",
        "sender": ":1.54",
        "type": 4,
        "flags": 1,
        "body": [
          [
            [
              "Text",
              [
                [
                  {
                    "type": "s",
                    "child": []
                  }
                ],
                [
                  "58.1%"
                ]
              ]
            ],
            [
              "Value",
              [
                [
                  {
                    "type": "d",
                    "child": []
                  }
                ],
                [
                  58.099998474121094
                ]
              ]
            ]
          ]
        ],
        "text": "58.1%",
        "value": 58.099998474121094,
        "senderName": 'com.victronenergy.battery.ttyO0',
        "instanceName": 0
      }])
      expect(deltas.length).to.equal(1)
      expect(deltas[0]).to.nested.deep.include({
        'updates[0].values[0]': {
          path: 'electrical.batteries.0.capacity.stateOfCharge',
          value: .58099998474121094
        }
      })
      var tree = toFull(deltas[0])
      tree.should.be.validSignalKVesselIgnoringIdentity
    })
  })

  describe('Time Remaining', function () {
    it('should return time remaining in normal case', function () {
      const deltas = venusToDeltas([{
        "serial": 21,
        "path": "/TimeToGo",
        "interface": "com.victronenergy.BusItem",
        "member": "PropertiesChanged",
        "signature": "a{sv}",
        "sender": ":1.53",
        "type": 4,
        "flags": 1,
        "body": [
          [
            [
              "Text",
              [
                [
                  {
                    "type": "s",
                    "child": []
                  }
                ],
                [
                  "19740s"
                ]
              ]
            ],
            [
              "Value",
              [
                [
                  {
                    "type": "d",
                    "child": []
                  }
                ],
                [
                  19739.998046875
                ]
              ]
            ]
          ]
        ],
        "text": "19740s",
        "value": 19739.998046875,
        "senderName": 'com.victronenergy.battery.ttyO0',
        "instanceName": 0
      }])
      expect(deltas.length).to.equal(1)
      expect(deltas[0]).to.nested.deep.include({
        'updates[0].values[0]': {
          path: 'electrical.batteries.0.capacity.timeRemaining',
          value: 19739.998046875
        }
      })
      var tree = toFull(deltas[0])
      tree.should.be.validSignalKVesselIgnoringIdentity
    })
  })

  describe('Panel Current', function () {
    it('should return panel curent in normal case', function () {
      const deltas = venusToDeltas([{
        "serial": 28,
        "path": "/Pv/I",
        "interface": "com.victronenergy.BusItem",
        "member": "PropertiesChanged",
        "signature": "a{sv}",
        "sender": ":1.49",
        "type": 4,
        "flags": 1,
        "body": [
          [
            [
              "Text",
              [
                [
                  {
                    "type": "s",
                    "child": []
                  }
                ],
                [
                  "16.1A"
                ]
              ]
            ],
            [
              "Value",
              [
                [
                  {
                    "type": "d",
                    "child": []
                  }
                ],
                [
                  16.143278121948242
                ]
              ]
            ]
          ]
        ],
        "text": "16.1A",
        "value": 16.143278121948242,
        "senderName": 'com.victronenergy.solarcharger.ttyO0',
        "instanceName": 0
      }])
      expect(deltas.length).to.equal(1)
      expect(deltas[0]).to.nested.deep.include({
        'updates[0].values[0]': {
          path: 'electrical.solar.0.panelCurrent',
          value: 16.143278121948242
        }
      })
      var tree = toFull(deltas[0])
      tree.should.be.validSignalKVesselIgnoringIdentity
    })
  })

    describe('Charger State', function () {
    it('should return panel charger state in normal case', function () {
      const deltas = venusToDeltas([{
        "serial": 28,
        "path": "/State",
        "interface": "com.victronenergy.BusItem",
        "member": "PropertiesChanged",
        "signature": "a{sv}",
        "sender": ":1.49",
        "type": 4,
        "flags": 1,
        "body": [
          [
            [
              "Text",
              [
                [
                  {
                    "type": "s",
                    "child": []
                  }
                ],
                [
                  "Bulk"
                ]
              ]
            ],
            [
              "Value",
              [
                [
                  {
                    "type": "d",
                    "child": []
                  }
                ],
                [
                  3
                ]
              ]
            ]
          ]
        ],
        "text": "Bulk",
        "value": 3,
        "senderName": 'com.victronenergy.solarcharger.ttyO0',
        "instanceName": 0
      }])
      expect(deltas.length).to.equal(1)
      expect(deltas[0]).to.nested.deep.include({
        'updates[0].values[0]': {
          path: 'electrical.solar.0.chargingMode',
          value: 'bulk'
        }
      })
      var tree = toFull(deltas[0])
      tree.should.be.validSignalKVesselIgnoringIdentity
    })
  })

  describe('Error Notification', function () {
    it('should raise a notification', function () {
      const deltas = venusToDeltas([{
        "serial": 28,
        "path": "/ErrorCode",
        "interface": "com.victronenergy.BusItem",
        "member": "PropertiesChanged",
        "signature": "a{sv}",
        "sender": ":1.49",
        "type": 4,
        "flags": 1,
        "body": [
          [
            [
              "Text",
              [
                [
                  {
                    "type": "s",
                    "child": []
                  }
                ],
                [
                  "Battery voltage too high"
                ]
              ]
            ],
            [
              "Value",
              [
                [
                  {
                    "type": "d",
                    "child": []
                  }
                ],
                [
                  2
                ]
              ]
            ]
          ]
        ],
        "text": "Battery voltage too high",
        "value": 2,
        "senderName": 'com.victronenergy.solarcharger.ttyO0',
        "instanceName": 0
      }])
      expect(deltas.length).to.equal(1)
      expect(deltas[0]).to.nested.deep.include({
        'updates[0].values[0]': {
          path: 'notifications.electrical.solar.0.error',
          value: {
            "message": "Battery voltage too high",
            "method": [
              "visual",
              "sound"
            ],
            "state": "alarm"
          }
        }
      })
      var tree = toFull(deltas[0])
      tree.should.be.validSignalKVesselIgnoringIdentity
    })
  })
  
  describe('Unknown Error Notification', function () {
    it('should raise an unknown notification', function () {
      const deltas = venusToDeltas([{
        "serial": 28,
        "path": "/ErrorCode",
        "interface": "com.victronenergy.BusItem",
        "member": "PropertiesChanged",
        "signature": "a{sv}",
        "sender": ":1.49",
        "type": 4,
        "flags": 1,
        "body": [
          [
            [
              "Text",
              [
                [
                  {
                    "type": "s",
                    "child": []
                  }
                ],
                [
                  "Battery voltage too high"
                ]
              ]
            ],
            [
              "Value",
              [
                [
                  {
                    "type": "d",
                    "child": []
                  }
                ],
                [
                  55
                ]
              ]
            ]
          ]
        ],
        "text": "Something went wrong",
        "value": 55,
        "senderName": 'com.victronenergy.inverter.ttyO0',
        "instanceName": 0
      }])
      expect(deltas.length).to.equal(1)
      expect(deltas[0]).to.nested.deep.include({
        'updates[0].values[0]': {
          path: 'notifications.electrical.inverters.0.error',
          value: {
            "message": "Unknown Error 55: Something went wrong",
            "method": [
              "visual",
              "sound"
            ],
            "state": "alarm"
          }
        }
      })
      var tree = toFull(deltas[0])
      tree.should.be.validSignalKVesselIgnoringIdentity
    })
  })


  describe('LastDischarge', function () {
    it('should return last discharge in normal case', function () {
      const deltas = venusToDeltas([{
        "serial": 28,
        "path": "/History/LastDischarge",
        "interface": "com.victronenergy.BusItem",
        "member": "PropertiesChanged",
        "signature": "a{sv}",
        "sender": ":1.54",
        "type": 4,
        "flags": 1,
        "body": [
          [
            [
              "Text",
              [
                [
                  {
                    "type": "s",
                    "child": []
                  }
                ],
                [
                  "-49.2Ah"
                ]
              ]
            ],
            [
              "Value",
              [
                [
                  {
                    "type": "d",
                    "child": []
                  }
                ],
                [
                  -49.20000076293945
                ]
              ]
            ]
          ]
        ],
        "text": "-49.2Ah",
        "value": -49.20000076293945,
        "senderName": "com.victronenergy.battery.ttyO0",
        "instanceName": 0
      }])
      expect(deltas.length).to.equal(1)
      expect(deltas[0]).to.nested.deep.include({
        'updates[0].values[0]': {
          path: 'electrical.batteries.0.capacity.dischargeSinceFull',
          value: -177120.00274658202000
        }
      })
      var tree = toFull(deltas[0])
      tree.should.be.validSignalKVesselIgnoringIdentity
    })
  })

  describe('Total aH Drawn', function () {
    it('should return TotalAhDrawn in normal case', function () {
      const deltas = venusToDeltas([{
        "serial": 31,
        "path": "/History/TotalAhDrawn",
        "interface": "com.victronenergy.BusItem",
        "member": "PropertiesChanged",
        "signature": "a{sv}",
        "sender": ":1.54",
        "type": 4,
        "flags": 1,
        "body": [
          [
            [
              "Text",
              [
                [
                  {
                    "type": "s",
                    "child": []
                  }
                ],
                [
                  "-583.3Ah"
                ]
              ]
            ],
            [
              "Value",
              [
                [
                  {
                    "type": "d",
                    "child": []
                  }
                ],
                [
                  -583.2999877929688
                ]
              ]
            ]
          ]
        ],
        "text": "-583.3Ah",
        "value": -583.2999877929688,
        "senderName": "com.victronenergy.battery.ttyO0",
        "instanceName": 0
      }])
      expect(deltas.length).to.equal(1)
      expect(deltas[0]).to.nested.deep.include({
        'updates[0].values[0]': {
          path: 'electrical.batteries.0.lifetimeDischarge',
          value: -2099879.9560546876800
        }
      })
      //var tree = toFull(deltas[0])
      //tree.should.be.validSignalKVesselIgnoringIdentity
    })
  })
})
