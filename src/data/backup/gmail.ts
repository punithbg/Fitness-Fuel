import { createMimeMessage } from 'mimetext/browser'
import { z } from 'zod'
import type { Backup } from './model'

export type MailAuthorization = { uid: string; email: string; accessToken: string }
export function buildBackupEmail(email: string, backup: Backup, bytes: Uint8Array) {
  z.email().parse(email)
  const message = createMimeMessage()
  message.setSender(email)
  message.setRecipient(email)
  message.setSubject(`Fitness & Fuel backup - ${backup.exportedAt.slice(0, 10)}`)
  message.addMessage({
    contentType: 'text/plain',
    data: `Your private fitness journal backup, exported ${backup.exportedAt}.\nBackup ID: ${backup.id}\nContains only records saved by export time. Keep a downloaded copy too.`,
  })
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  message.addAttachment({
    filename: `fitness-and-fuel-${backup.exportedAt.slice(0, 10)}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    data: btoa(binary),
  })
  return message.asEncoded()
}
export async function sendBackupEmail(
  authorization: MailAuthorization,
  backup: Backup,
  bytes: Uint8Array,
  request: typeof fetch = fetch,
) {
  if (authorization.uid !== backup.source.uid || authorization.email !== backup.source.email)
    throw new Error('The Gmail account must match the account that exported this backup.')
  const raw = buildBackupEmail(authorization.email, backup, bytes)
  let response: Response
  try {
    response = await request('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authorization.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(30000),
    })
  } catch {
    throw new Error(
      'Email status is unknown. Check Gmail Sent before retrying. Your download is still available.',
    )
  }
  if (!response.ok)
    throw new Error(
      `Gmail did not accept the message (${response.status}). Your download is still available.`,
    )
  return 'Gmail accepted the backup. Delivery is not guaranteed; check your mailbox.'
}
