import { CronJob } from 'cron'

const cron = new CronJob('0 * * * *', () => {
  console.log('Executing cron job once every hour')
})

export { cron }
