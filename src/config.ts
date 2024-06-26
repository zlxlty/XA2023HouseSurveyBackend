import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

export interface Config {
  port: number
  loggingLevel: string
  leancloudAppId: string
  leancloudAppKey: string
  leancloudMasterKey: string
  leancloudServerUrl?: string
  leancloudHookKey: string
  openaiApiKey: string
  redisUrl: string
}

const config: Config = {
  port: +(process.env.PORT || 3000),
  loggingLevel: process.env.LOGGING_LEVEL || 'info',
  leancloudAppId: process.env.LEANCLOUD_APP_ID || '',
  leancloudAppKey: process.env.LEANCLOUD_APP_KEY || '',
  leancloudMasterKey: process.env.LEANCLOUD_MASTER_KEY || '',
  leancloudServerUrl: process.env.LEANCLOUD_SERVER_URL,
  leancloudHookKey: process.env.LEANCLOUD_HOOK_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  redisUrl: process.env.REDIS_URL || process.env.REDIS_URL_mirro || '',
}

export { config }
