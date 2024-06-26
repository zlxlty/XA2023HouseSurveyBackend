import fetch from 'node-fetch'
import { Readable } from 'stream'
import { TextDecoder } from 'util'

export type ChatGPTAgent = 'user' | 'system' | 'assistant'

export interface ChatGPTMessage {
  role: ChatGPTAgent
  content: string
}

export interface OpenAIStreamPayload {
  model: string
  messages: ChatGPTMessage[]
  temperature?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  max_tokens?: number
  stream?: boolean
  n?: number
}

export async function OpenAIStream(
  payload: OpenAIStreamPayload,
): Promise<Readable> {
  const decoder = new TextDecoder()

  let counter = 0

  const { createParser } = await import('eventsource-parser')

  const res = await fetch(
    'https://mirro-ai-sg.hyperex.cc/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
      },
      body: JSON.stringify(payload),
    },
  )

  const stream = new Readable({
    async read() {
      // do nothing
    },
    async destroy() {
      // do nothing
    },
  })

  // callback
  function onParse(event: any) {
    if (event.type === 'event') {
      const data = event.data
      // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
      if (data === '[DONE]') {
        stream.push(null)
        return
      }
      try {
        const json = JSON.parse(data)
        const text = json.choices[0].delta?.content || ''
        if (counter < 2 && (text.match(/\n/) || []).length) {
          // this is a prefix character (i.e., "\n\n"), do nothing
          return
        }
        stream.push(
          `data: ${JSON.stringify({
            token: text,
          })}\n\n`,
        ),
          counter++
      } catch (e) {
        // maybe parse error
        stream.destroy(e as any)
      }
    }
  }

  // stream response (SSE) from OpenAI may be fragmented into multiple chunks
  // this ensures we properly read chunks and invoke an event for each SSE event stream
  const parser = createParser(onParse)
  res.body.on('data', (chunk: Buffer) => {
    parser.feed(decoder.decode(chunk))
  })
  res.body.on('error', (error: Error) => {
    stream.destroy(error)
  })

  return stream
}
