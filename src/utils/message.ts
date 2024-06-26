import { XMLParser } from 'fast-xml-parser'
import { logger } from 'src/logger'

interface ParsedMessage {
  type: 'ai' | 'user'
  text: string
  attrs?: MessageAttributes
}

interface MessageAttributes {
  'need-ai-reply'?: 'true'
  hide?: 'true'
  statusId?: string
  imageURL?: string
  kind?: 'invite' | 'remove' | 'init'
}

export function XML2JSON(raw: string): ParsedMessage {
  const options = {
    attributeNamePrefix: '',
    ignoreAttributes: false,
    parseNodeValue: false,
    parseAttributeValue: true,
  }

  const parser = new XMLParser(options)
  const parsed = parser.parse(raw)
  logger.debug('XML message parsed', {
    raw,
    parsed,
  })
  const parsedContent = Object.values(parsed)[0] as any
  const parsedTag = Object.keys(parsed)[0] as string

  const result: Partial<ParsedMessage> = {
    type: parsedTag === 'AIMessage' ? 'ai' : 'user',
  }

  if (typeof parsedContent === 'string') {
    result.text = parsedContent
  } else {
    result.text = parsedContent['#text']
    delete parsedContent['#text']

    result.attrs = parsedContent
  }

  return result as ParsedMessage
}
