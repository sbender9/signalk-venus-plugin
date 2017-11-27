module.exports = function (venusMessage) {
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
