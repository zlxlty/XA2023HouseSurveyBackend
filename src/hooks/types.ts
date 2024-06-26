export interface IMMessageEventParams {
  fromPeer: string
  receipt: boolean
  content: string
  convId: string
  bin: boolean
  transient: boolean
  sourceIP: string
  timestamp: number
}

export interface IMMessageSentEventParams extends IMMessageEventParams {
  msgId: string
  onlinePeers: string[]
  offlinePeers: string[]
}

export interface IMMessageReceivedEventParams extends IMMessageEventParams {
  groupId: string | null
  system: string | null
  toPeers: string[]
}
