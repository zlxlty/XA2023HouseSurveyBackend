import leancloudStorage, { Queriable, Query } from 'leancloud-storage'

export type LC = typeof leancloudStorage

export interface OtherUser extends Partial<LC['User']> {
  followerQuery<OtherUser extends Queriable>(): Query<OtherUser>
  id: string
}
