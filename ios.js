

const venusToDeltas = require('./venusToDeltas')

var vd = venusToDeltas({}, {usePosition:true})

global.toDelta = vd.toDelta

