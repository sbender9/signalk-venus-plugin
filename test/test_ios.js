/* eslint-env mocha */

let input = [
  {
    instanceName: 0,
    path: '/Dc/Vebus/Power',
    senderName: 'com.victronenergy.system.0',
    topic: 'N/985dadcb01dd/system/0/Dc/Vebus/Power',
    value: 282
  },
  {
    instanceName: 93,
    path: '/Position/Latitude',
    senderName: 'com.victronenergy.gps.93',
    topic: 'N/c0619ab4e25c/gps/93/Position/Latitude',
    value: '39.06312942504883'
  },
  {
    instanceName: 93,
    path: '/Position/Longitude',
    senderName: 'com.victronenergy.gps.93',
    topic: 'N/c0619ab4e25c/gps/93/Position/Longitude',
    value: '139.06312942504883'
  }
]

require('../dist/ios')

let toDelta = global.getToDelta((_path) => {
  //console.log(`putRegistrar ${path}`)
})

describe(`ios tests`, () => {
  input.forEach((item) => {
    it(`${item.path} works`, (done) => {
      toDelta(item)
      done()
    })
  })
})
