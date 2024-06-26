import { Context } from 'koa'
import { request, responsesAll, summary, tagsAll } from 'koa-swagger-decorator'
import LC from 'leanengine'
import { flatten } from 'lodash'
import fetch from 'node-fetch'
import { config } from 'src/config'
import { parsePrompt } from 'src/utils/aigc'
import { OpenAIStream, OpenAIStreamPayload } from 'src/utils/openAIStream'
import { UserProfile } from '../types'

interface QAPairConfigBase {
  shortId: string
  hint: string
  defaultQuestion?: string
}

export type InputType =
  | 'single-line-input'
  | 'multi-line-input'
  | 'date-input'
  | 'single-select'
  | 'multi-select'

type ChatGPTAgent = 'user' | 'assistant' | 'system'

export interface TextQAPair extends QAPairConfigBase {
  inputType: 'single-line-input' | 'multi-line-input'
  placeholder: string
}

export interface SingleSelectionQAPair extends QAPairConfigBase {
  inputType: 'single-select'
  options: { display: string; value: string }[]
}

export interface MultiSelectionQAPair extends QAPairConfigBase {
  inputType: 'multi-select'
  options: string[]
}

export interface DateQAPair extends QAPairConfigBase {
  inputType: 'date-input'
}

export type QAPairConfig =
  | TextQAPair
  | SingleSelectionQAPair
  | MultiSelectionQAPair
  | DateQAPair

export interface QuestionBotRequestBody {
  promptId: string
  history: Message[]
}

export interface Message {
  role: ChatGPTAgent
  content: string
}

export interface TagClusters {
  [category: string]: string[]
}

interface ConcludeBotRequestBody {
  questionsList: QAPairConfig[][]
  messages: Message[]
}

interface FunctionBody {
  type: string
  description: string
  enum?: string[]
}

interface PromptTemplate extends LC.Object {
  shortId: string
  role: ChatGPTAgent
  content: string
  parameters: string[]
}

@responsesAll({
  200: { description: 'success' },
  400: { description: 'bad request' },
  401: { description: 'unauthorized' },
})
@tagsAll(['Bot'])
export class BotController {
  @request('post', '/bot/conclude')
  @summary('Initialize conclude bot')
  public static async postConcludeBot(ctx: Context): Promise<void> {
    const { questionsList, messages } = ctx.request
      .body as ConcludeBotRequestBody

    const properties = flatten(questionsList).reduce(
      (
        acc: { [shortId: string]: FunctionBody },
        questionConfig: QAPairConfig,
      ) => {
        if (!questionConfig) return acc

        const body: FunctionBody = {
          type: 'string',
          description: '用户的' + questionConfig.hint,
        }

        if (questionConfig.inputType === 'single-select') {
          body.enum = questionConfig.options.map(config => config.value)
        }

        acc[questionConfig.shortId] = body
        return acc
      },
      {} as { [shortId: string]: FunctionBody },
    )

    const profilesResp = await fetch(
      'https://mirro-ai-sg.hyperex.cc/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openaiApiKey ?? ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo-16k-0613',
          messages: [{ role: 'user', content: JSON.stringify(messages) }],
          functions: [
            {
              name: 'get_user_profile_information',
              description:
                "Get information for user's profile in Chinese from a dialogue with assistant. Attention: Keep all emojis in the dialogue",
              parameters: {
                type: 'object',
                properties,
              },
            },
          ],
          function_call: 'auto',
          stream: false,
        }),
      },
    )
    const profiles: { [key: string]: string } = await profilesResp.json().then(
      ({
        choices: [
          {
            message: {
              function_call: { arguments: profiles },
            },
          },
        ],
      }) => JSON.parse(profiles),
    )

    const response = Object.entries(profiles).reduce(
      ({ partialProfile, tagClusters }, [key, value]) => {
        switch (true) {
          case key.startsWith('tag-'):
            tagClusters[key.replace('tag-', '')] = value.split(',')
            break
          case key.startsWith('mbti-'):
            partialProfile['mbti'] ??= ''
            partialProfile['mbti'] += value
            break
          case key === 'breakpoint':
            return {
              partialProfile,
              tagClusters,
            }
          default:
            ;(partialProfile as any)[key] = value
            break
        }

        return {
          partialProfile,
          tagClusters,
        }
      },
      {
        partialProfile: {} as Partial<UserProfile>,
        tagClusters: {} as TagClusters,
      },
    )

    ctx.body = response
  }

  @request('post', '/bot/question')
  @summary('Initialize question bot')
  public static async postQuestionBot(ctx: Context): Promise<void> {
    const { promptId, history } = ctx.request
      .body satisfies QuestionBotRequestBody

    if (!promptId || !history) {
      ctx.status = 400
      ctx.body = { error: 'Not enough parameters' }
      return
    }

    const promptTemplate = (await new LC.Query('Prompt')
      .equalTo('shortId', promptId)
      .first()) as PromptTemplate

    if (!promptTemplate) {
      ctx.status = 400
      ctx.body = { error: 'Invalid PromptId' }
      return
    }

    let prompt = ''

    try {
      prompt = parsePrompt(
        promptTemplate.get('content'),
        promptTemplate.get('parameters')
          ? promptTemplate.get('parameters').map((p: string) => ({
              key: p,
              value: ctx.request.body[p],
            }))
          : [],
        '{}',
      )
    } catch (e) {
      console.error(e)
    }

    console.log([
      { role: promptTemplate.get('role') || 'system', content: prompt },
      ...history,
    ])

    const payload: OpenAIStreamPayload = {
      model: 'gpt-3.5-turbo-16k-0613',
      messages: [
        { role: promptTemplate.get('role') || 'system', content: prompt },
        ...history,
      ],
      temperature: ctx.request.body['temperature'] || 0.9,
      stream: true,
    }

    ctx.response.set({
      'Content-Type': 'text/event-stream',
      'Transfer-Encoding': 'chunked',
    })
    const stream = await OpenAIStream(payload)
    ctx.body = stream
  }
}
