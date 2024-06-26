import LC from 'leanengine'
import { IMMessageSentEventParams } from 'src/hooks/types'
import { logger } from 'src/logger'
import { XML2JSON as parseXMLMessage } from 'src/utils/message'
import { sendSMS } from 'src/utils/sms'
import { sendCommunicationPushNotification } from '../utils/push'

LC.Cloud.onIMMessageSent(async request => {
  logger.debug('onIMMessageSent request.params', request.params)

  const params = request.params as IMMessageSentEventParams
  const conversation = await new LC.Query<LC.Conversation>('_Conversation').get(
    params.convId,
  )
  const conversationType = conversation.get('attributes')?.type
  if (conversationType !== 'private') {
    logger.info('not private conversation; skipping notification')
    return
  }

  const sendingUser = await new LC.Query<LC.User>('_User').get(params.fromPeer)
  if (!sendingUser) {
    logger.warn('unable to get current user')
    return
  }

  const sendingUserId = sendingUser.id

  // 获取所有「对方」（非发送方）的 userId
  const receivingUserIds = (conversation.get('m') as string[]).filter(
    member => member !== sendingUserId,
  )

  if (receivingUserIds.length !== 1) {
    logger.warn(
      'unexpected private conversation members length',
      conversation.id,
      'members',
      receivingUserIds,
      'original members',
      conversation.get('m'),
      'skipping',
    )
    return
  }

  const receivingUserId = receivingUserIds[0]

  const receivingUser = await new LC.Query<LC.User>('_User').get(
    receivingUserId,
  )
  const receivingUserProfile = await new LC.Query('UserProfile')
    .equalTo('User', receivingUser)
    .first()

  if (!receivingUserProfile) {
    logger.warn('unable to get opposite user profile')
    return
  }

  const content = JSON.parse(params.content)._lctext
  const message = parseXMLMessage(content)

  const sendingUserProfile = await new LC.Query('UserProfile')
    .equalTo('User', sendingUser)
    .first()

  const title = (() => {
    if (sendingUserProfile) {
      const sendingUserUsername = sendingUserProfile.get('username')
      if (message.attrs?.['need-ai-reply']) {
        if (message.type === 'ai') {
          return `${sendingUserUsername} 的镜身`
        } else {
          return `${sendingUserUsername} 对你的镜身说`
        }
      } else {
        return message.attrs?.statusId
          ? `${sendingUserUsername} 回应了你的一条动态`
          : sendingUserUsername
      }
    } else {
      return 'unknown'
    }
  })()

  const { installations } = await sendCommunicationPushNotification(
    receivingUser,
    sendingUser,
    params.convId,
    title,
    message.text,
    '/chat/private/' + sendingUserId,
  )

  if (installations === 0) {
    logger.warn(
      'no installation found for user. sending sms instead',
      receivingUser.id,
    )

    await sendSMS({
      mobilePhoneNumber: receivingUser.getMobilePhoneNumber(),
      template: '新消息通知',
      rateLimit: {
        key: 'new-message',
        duration: 60 * 60 * 6,
      },
    })
  }
})
