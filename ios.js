

const venusToDeltas = require('./venusToDeltas')

//var vd = venusToDeltas({}, {usePosition:true})

//global.toDelta = vd.toDelta

global.getToDelta = (putRegistrar) => {
  return venusToDeltas({ supportsMetaDeltas: true }, {usePosition:true}, {}, putRegistrar).toDelta
}
