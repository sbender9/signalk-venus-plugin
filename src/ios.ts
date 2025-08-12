/* eslint-disable @typescript-eslint/no-explicit-any */
import { VenusToSignalK } from './venusToDeltas'
import { ServerAPI } from '@signalk/server-api'
;(global as any).getToDelta = (putRegistrar: any) => {
  const vsk = new VenusToSignalK(
    {
      getSelfPath: (_path: string) => undefined
    } as ServerAPI,
    {},
    { usePosition: true },
    putRegistrar
  )
  return vsk.toDelta.bind(vsk)
}
