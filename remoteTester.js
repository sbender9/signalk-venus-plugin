#!/usr/bin/env node

const venusSignalk = require('./')({
    handleMessage: (providerId, delta) => {
        // console.log(JSON.stringify(delta, null, 2))
    },
    on: (eventName, listener) => {
        console.log(`"registering" listener for event  ${eventName}`)
    },
    removeListener: f => {
        console.log(`"Removing" listener`)
    }
})

venusSignalk.start({
  installType: 'remote',
  dbusAddress: 'tcp:host=192.168.1.119,port=78'
})

setTimeout(venusSignalk.stop, 15 * 1000)
