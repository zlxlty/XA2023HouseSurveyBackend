import { SwaggerRouter } from 'koa-swagger-decorator'
import { BotController } from 'src/controller/bot'
import { MatchController } from 'src/controller/match'
import { MomentController } from 'src/controller/moment'
import { SandboxController } from 'src/controller/sandbox'
import { UserController } from 'src/controller/user'

const apiRouter = new SwaggerRouter()

apiRouter.get('/match', MatchController.getMatch)
apiRouter.get('/profile/:id', UserController.getUserProfileById)
apiRouter.get('/moment', MomentController.getMoments)
apiRouter.post('/moment', MomentController.createMoment)
apiRouter.delete('/moment/:id', MomentController.deleteMoment)
apiRouter.get('/moment/meme/:id', MomentController.getMemeById)
apiRouter.get('/sandbox/:id?', SandboxController.getSandbox)
apiRouter.post('/bot/question', BotController.postQuestionBot)
apiRouter.post('/bot/conclude', BotController.postConcludeBot)

// Swagger endpoint
apiRouter.swagger({
  title: 'Mirro API',
  description: 'Mirro API',
  version: '0.0.1',
})

export { apiRouter }
