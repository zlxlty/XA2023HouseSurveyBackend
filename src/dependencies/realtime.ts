import { Realtime } from 'leancloud-realtime'
import { config } from 'src/config'

export const realtime = new Realtime({
  appId: config.leancloudAppId,
  appKey: config.leancloudAppKey,
  server: 'https://lcapi.mirro.hyperex.cc',
  noBinary: true,
})
