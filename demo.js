const venusSignalk = require('./')({
    handleMessage: (providerId, delta) => {
        console.log(JSON.stringify(delta, null, 2))
    }
})

venusSignalk.start()