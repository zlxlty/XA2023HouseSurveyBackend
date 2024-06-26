import { Redis } from 'ioredis'
import { config } from 'src/config'

export const redis = new Redis(config.redisUrl)
