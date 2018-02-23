#!/usr/bin/env node

const venusSignalk = require('./')({
    handleMessage: (providerId, delta) => {
        // console.log(JSON.stringify(delta, null, 2))
    },
    on: (eventName, listener) => {
        console.log(`"registering" listener for event  ${eventName}`)
    }
})

venusSignalk.start({
  installType: 'remote',
  dbusAddress: 'tcp:host=192.168.1.120,port=78'
})

