import LC from 'leanengine'
import { logger } from 'src/logger'
import { sendGeneralPushNotification } from 'src/utils/push'
import { sendSMS } from 'src/utils/sms'

LC.Cloud.afterSave('_FriendshipRequest', async request => {
  logger.debug('_FriendshipRequest request.object', request.object)

  const object = await new LC.Query('_FriendshipRequest').get(
    request.object.id!,
  )

  const status = object.get('status') as 'pending' | 'accepted' | 'declined'
  if (status !== 'pending') return

  const fromUser = object.get('user') as LC.User
  logger.debug('fromUser', fromUser)
  const fromUserProfile = await new LC.Query('UserProfile').get(fromUser.id!)
  logger.debug('fromUserProfile', fromUserProfile)
  const toUser = object.get('friend') as LC.User
  logger.debug('toUser', toUser)

  await Promise.all([
    sendSMS({
      mobilePhoneNumber: toUser.getMobilePhoneNumber(),
      template: '申请好友',
      username: fromUserProfile.get('username'),
      rateLimit: {
        key: 'friendship',
        duration: 60 * 60 * 1,
      },
    }),
    sendGeneralPushNotification(
      toUser,
      '新的超级好友请求',
      `${fromUserProfile.get('username')} 想与你成为超级好友`,
    ),
  ])
})
