import LC from 'leanengine'
import { logger } from 'src/logger'
import { sendSMS } from 'src/utils/sms'
import { sendGeneralPushNotification } from '../utils/push'

LC.Cloud.afterUpdate('StatusLikes', async ({ object, currentUser }) => {
  if (!object.updatedKeys?.includes('likes')) return

  if (!object.id) {
    logger.warn("cannot find status likes object's id")
    return
  }

  if (!currentUser) {
    logger.warn('current user is not logged in')
    return
  }

  // likes have been updated
  const statusLikesQueriable = await new LC.Query('StatusLikes').get(object.id)
  const likers = statusLikesQueriable.get('likes') as LC.Object[]

  if (!likers.some(({ id }) => id === currentUser.id)) {
    logger.info('current status is not liked by current user. skipping notification')
    return
  }

  const statusId = statusLikesQueriable.get('statusId') as string
  const statusQueriable = await new LC.Query('_Status').get(statusId)
  const statusOwnerId = statusQueriable.get('source').id as string

  if (statusOwnerId === currentUser.id) {
    logger.info('current user is the same as status user. skipping')
    return
  }

  const statusOwner = (await new LC.Query('_User').get(statusOwnerId)) as LC.User
  const statusOwnerPhoneNumber = statusOwner.getMobilePhoneNumber()

  await Promise.all([
    sendSMS({
      mobilePhoneNumber: statusOwnerPhoneNumber,
      template: '新点赞通知',
      rateLimit: {
        key: 'status-like',
        duration: 60 * 60 * 12,
      },
    }),
    sendGeneralPushNotification(
      statusOwner,
      '限时动态有了新的点赞',
      '你的超级好友在 Mirro 上给你的限时动态点了赞',
    ),
  ])
}
)
