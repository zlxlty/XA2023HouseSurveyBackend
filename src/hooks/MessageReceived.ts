import LC from 'leanengine'
import fetch from 'node-fetch'
import { logger } from 'src/logger'
import { IMMessageReceivedEventParams } from './types'

LC.Cloud.onIMMessageReceived(async request => {
  const params = request.params as IMMessageReceivedEventParams
  logger.debug('onIMMessageReceived request.params', params)

  if (params.bin) return

  const blocked = !!(await new LC.Query('BlockedRelationship')
    .equalTo(
      'blockedUser',
      LC.Object.createWithoutData('_User', params.fromPeer),
    )
    .containedIn(
      'createdUser',
      params.toPeers.map(peer => LC.Object.createWithoutData('_User', peer)),
    )
    .first())
  logger.debug('BlockedRelationship status', { blocked, params })
  if (blocked) {
    logger.info(
      'blocked message %s from %s to %s',
      params.convId,
      params.fromPeer,
      params.toPeers,
    )
    return {
      drop: true,
      code: 403,
      detail: '你已被对方拉黑，无法发送消息',
    }
  }

  const content = params.content
  const processedContent = content

  if (params.toPeers[0] === 'meme-handler') {
    logger.debug('meme-handler message')

    fetch('https://mirro-ai-cn.hyperex.cc/imMemehandler', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mirro-key': 'eEfykECRwfugW8Wc3L4koRuNi3EutE7r',
      },
      body: JSON.stringify({
        message: content,
        from: params.fromPeer,
      }),
    })
    return
  }

  if (content.includes('need-group-ai-reply')) {
    logger.debug('need-group-ai-reply message')

    fetch('https://mirro-ai-cn.hyperex.cc/groupMessageHook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mirro-key': 'eEfykECRwfugW8Wc3L4koRuNi3EutE7r',
      },
      body: JSON.stringify({
        message: content,
        from: params.fromPeer,
      }),
    })
  }

  // if (params.toPeers.length > 1) return;

  if (content.includes('need-ai-reply') && params.toPeers.length <= 1) {
    logger.debug('need-ai-reply message')

    fetch('https://mirro-ai-cn.hyperex.cc/getRes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mirro-key': 'eEfykECRwfugW8Wc3L4koRuNi3EutE7r',
      },
      body: JSON.stringify({
        message: content,
        from: params.fromPeer,
        to: params.toPeers[0],
      }),
    })
  }

  return {
    content: processedContent,
  }
})
