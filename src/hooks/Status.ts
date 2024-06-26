import async from 'async'
import LC from 'leanengine'
import { logger } from 'src/logger'
import { sendGeneralPushNotification } from 'src/utils/push'
import { sendSMS } from 'src/utils/sms'

LC.Cloud.afterSave('_Status', async request => {
  logger.debug('_Status request.object', request.object)

  const object = await new LC.Query('_Status').get(request.object.id!)

  const fromUser = object.get('user') as LC.User
  const fromUserProfile = await new LC.Query('UserProfile').get(fromUser.id!)

  const followees = await new LC.Query('_Followee')
    .equalTo('user', fromUser)
    .equalTo('friendStatus', true)
    .find()

  logger.info('sending status notification to %d followees', followees.length)

  await async.mapLimit(followees, 10, async (followee: LC.Queriable) => {
    const toUser = followee.get('followee') as LC.User

    await Promise.all([
      sendSMS({
        mobilePhoneNumber: toUser.getMobilePhoneNumber(),
        template: '有新 Story',
        friendName: fromUserProfile.get('username'),
        rateLimit: {
          key: 'story',
          duration: 60 * 60 * 24,
        },
      }),
      sendGeneralPushNotification(
        toUser,
        '超级好友发了一条新动态',
        `${fromUserProfile.get('username')} 发了一条新动态`,
      ),
    ])

    logger.info('sent status notification to %s', toUser.id)
  })
})
