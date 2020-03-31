

const venusToDeltas = require('./venusToDeltas')

var vd = venusToDeltas({}, {})

global.toDelta = vd.toDelta

