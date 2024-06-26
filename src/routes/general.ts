import Router from '@koa/router'
import { GeneralController } from 'src/controller/general'

const generalRouter = new Router()

generalRouter.get('/', GeneralController.helloWorld)
generalRouter.get('/_health', GeneralController.healthCheck)

export { generalRouter }
