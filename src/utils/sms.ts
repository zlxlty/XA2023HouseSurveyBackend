import LCC from 'leancloud-storage'
import { logger } from 'src/logger'
import { redis } from '../dependencies/redis'

type SendSMSAvailableTemplate =
  | { template: '新消息通知' }
  | { template: '新点赞通知' }
  | { template: '申请好友'; username: string }
  | { template: '有新 Story'; friendName: string }

type SendSMSOptions = SendSMSAvailableTemplate & {
  mobilePhoneNumber: string
  sign?: string

  rateLimit: {
    key: string
    /** duration is the number of seconds that the rate limit will be in effect */
    duration: number
  }
}

const smsDevWhitelist = ['+8618503850163']

export const sendSMS = async (options: SendSMSOptions): Promise<void> => {
  const { mobilePhoneNumber, sign, rateLimit, ...smsContentOptions } = options

  if (!smsDevWhitelist.includes(options.mobilePhoneNumber)) {
    logger.info('sendSMS: skipping due to dev whitelist', {
      mobilePhoneNumber: options.mobilePhoneNumber,
      smsContentOptions,
    })
    return
  }

  const { key, duration } = rateLimit
  const redisKey = `rlim:${key}:${mobilePhoneNumber}`
  const redisValue = await redis.get(redisKey)
  if (redisValue) {
    logger.info('sendSMS: rate limit exceeded for user. skipping', {
      redisKey,
    })
    return
  }
  await LCC.Cloud.requestSmsCode({
    mobilePhoneNumber,
    sign: sign ?? '骇斯科技',
    ...smsContentOptions,
  })
  await redis.set(redisKey, '1', 'EX', duration)
}
