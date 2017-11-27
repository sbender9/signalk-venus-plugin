module.exports = function (venusMessage) {
  if (venusMessage.interface != 'com.victronenergy.BusItem' ||
      venusMessage.member != 'PropertiesChanged')
    return []

  return [
    {
      updates: [
        {
          $source: 'plugins.venus-to-signalk',
          values: [
            {
              path: 'electrical.batteries.1.voltage',
              value: Number(venusMessage.value)
            }
          ]
        }
      ]
    }
  ]
}
