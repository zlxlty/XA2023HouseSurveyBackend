import crypto from 'crypto'
import { config } from 'src/config'

export const signLogin = async (clientId: string) => {
  return sign((timestamp, nonce) => [
    config.leancloudAppId,
    clientId,
    '',
    timestamp,
    nonce,
  ])
}

export const signOperateConversation = async (
  conversationId: string,
  clientId: string,
  members: string[],
  action: string,
) => {
  return sign((timestamp, nonce) => [
    config.leancloudAppId,
    clientId,
    conversationId,
    members.sort().join(':'),
    timestamp,
    nonce,
    action,
  ])
}
function sign(func: (timestamp: string, nonce: string) => string[]) {
  const timestamp = Math.round(Date.now() / 1000)
  const nonce = getNonce(5)
  const parts = func(timestamp.toString(), nonce)
  const msg = parts.filter(part => part != null).join(':')
  const signature = signSha1(msg, config.leancloudMasterKey)
  return { timestamp, nonce, signature, msg }
}

function signSha1(text: string, key: string) {
  return crypto.createHmac('sha1', key).update(text).digest('hex')
}

function getNonce(chars: number) {
  const d = []
  for (let i = 0; i < chars; i++) {
    d.push(Math.round(Math.random() * 10))
  }
  return d.join('')
}
