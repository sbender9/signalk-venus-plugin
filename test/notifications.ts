import { expect } from 'chai'
import { ServerAPI } from '@signalk/server-api'
import {
  VenusToSignalK,
  convertErrorToNotification
} from '../src/venusToDeltas'

type NotificationValue = { state: string; message: string; method?: string[] }

const cleared = { value: { state: 'normal', message: 'NoGridMeter' } }
const silenced = {
  value: { state: 'warn', message: 'NoGridMeter', method: ['visual'] }
}

const appWith = (existing: unknown) =>
  ({ getSelfPath: (_path: string) => existing }) as unknown as ServerAPI

const alarmValue = (existing: unknown, value: number) => {
  const vsk = new VenusToSignalK(appWith(existing), {}, {}, () => undefined)
  const deltas = vsk.toDelta({
    path: '/Alarms/NoGridMeter',
    senderName: 'com.victronenergy.hub4',
    value,
    instanceName: 0
  } as never)
  const update = deltas[0].updates[0]
  return (
    'values' in update ? update.values[0].value : undefined
  ) as NotificationValue
}

describe('notifications raised again after being cleared', () => {
  it('an alarm gets the default method back', () => {
    expect(alarmValue(cleared, 1)).to.deep.equal({
      state: 'warn',
      message: 'NoGridMeter',
      method: ['visual', 'sound']
    })
  })

  it('an alarm keeps the method of a notification still raised', () => {
    expect(alarmValue(silenced, 2).method).to.deep.equal(['visual'])
  })

  it('an error code gets the default method back', () => {
    const value = convertErrorToNotification(
      appWith({ value: { state: 'normal', message: 'No Error' } }),
      {
        path: '/ErrorCode',
        senderName: 'com.victronenergy.solarcharger.ttyO1',
        value: 2,
        instanceName: 0
      } as never,
      'notifications.electrical.solar.0.error'
    )
    expect(value?.method).to.deep.equal(['visual', 'sound'])
  })
})
