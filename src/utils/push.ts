import LCC, { Installation } from 'leancloud-storage'
import LC from 'leanengine'
import { logger } from 'src/logger'

export async function sendCommunicationPushNotification(
  receivingUser: LC.User,
  initiatingUser: LC.User,
  associatedId: string,
  title: string,
  message: string,
  link: string,
): Promise<{ installations: number }> {
  const installations = await new LC.Query<Installation>('_Installation')
    .equalTo('owner', receivingUser)
    .find()

  if (installations.length === 0) {
    logger.info('no installation found for user', receivingUser.id)
    return { installations: 0 }
  }

  const haveDevDevice = installations.some(
    installation => installation.get('environmentType') === 'dev',
  )

  const environmentTypes = haveDevDevice
    ? (['dev', 'prod'] as const)
    : (['prod'] as const)

  const initiatingUserProfile = await new LC.Query('UserProfile')
    .equalTo('User', initiatingUser)
    .first()

  for (const environmentType of environmentTypes) {
    await LCC.Push.send({
      where: new LC.Query<Installation>('_Installation').equalTo(
        'owner',
        receivingUser,
      ),
      data: {
        'mutable-content': 1,
        'apns-push-type': 'alert',
        'thread-id': associatedId,

        alert: {
          title,
          body: message,
        },

        type: 'communication',
        senderPhoneNumber: initiatingUser.getMobilePhoneNumber(),
        senderAvatarURL: initiatingUserProfile?.get('avatarURL'),
        associatedId,
        badge: 'Increment',
        link,
      },
      expiration_interval: 60 * 60 * 24,
      prod: environmentType,
    })

    logger.info('communication push notification sent to user', {
      environmentType,
      receivingUserId: receivingUser.id,
      initiatingUserId: initiatingUser.id,
      associatedId,
      title,
      messageContent: message,
    })
  }

  return { installations: installations.length }
}

export async function sendGeneralPushNotification(
  receivingUser: LC.User,
  title: string,
  message: string,
): Promise<void> {
  const installationQuery = new LC.Query<Installation>('_Installation')
  installationQuery.equalTo('owner', receivingUser)
  const environmentType =
    (await installationQuery.first())?.get('environmentType') ?? 'prod'

  await LCC.Push.send({
    where: new LC.Query<Installation>('_Installation').equalTo(
      'owner',
      receivingUser,
    ),
    data: {
      alert: {
        title,
        body: message,
      },
      badge: 'Increment',
    },
    prod: environmentType,
  })

  logger.info(
    'general push notification sent to user',
    receivingUser.id,
    title,
    message,
  )
}
