import { TextMessage } from 'leancloud-realtime'
import LC from 'leanengine'
import { realtime } from 'src/dependencies/realtime'
import { logger } from 'src/logger'
import {
  signLogin,
  signOperateConversation,
} from 'src/utils/realtime-signature'
import { sleep } from 'src/utils/sleep'

interface IMConversationStartedEventParams {
  convId: string
}

LC.Cloud.onIMConversationStarted(async request => {
  const params = request.params as IMConversationStartedEventParams
  logger.debug('onIMConversationStarted request.params', params)

  const conversation = await new LC.Query<LC.Conversation>('_Conversation').get(
    params.convId,
  )
  if (!conversation.id) {
    logger.warn('unable to get conversation')
    return
  }

  const conversationType = conversation.get('attributes')?.type

  const maybeSandbox = await new LC.Query<LC.Object>('Sandbox')
    .equalTo('id', conversationType)
    .first()

  if (!maybeSandbox) {
    logger.debug('not sandbox conversation; skipping notification')
    return
  }

  const welcomeMessages = maybeSandbox.get('welcomeMessages') as Record<
    string,
    string
  >[] // { "AIUserId": "Welcome message" }

  for (const pair of welcomeMessages) {
    const [AIId, pureMessage] = Object.entries(pair)[0]
    await sleep(Math.random() * 1e3 + 1e3)
    const aiClient = await realtime.createIMClient(AIId, {
      signatureFactory: signLogin,
      conversationSignatureFactory: signOperateConversation,
    })
    const msg = new TextMessage(`<AIMessage>${pureMessage}</AIMessage>`)
    await (await aiClient.getConversation(conversation.id)).send(msg)
  }
})
