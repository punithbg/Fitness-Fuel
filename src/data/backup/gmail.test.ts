import { describe, expect, it, vi } from 'vitest'
import { createBackup } from './model'
import { emptyJournal } from '../schemas'
import { buildBackupEmail, sendBackupEmail } from './gmail'

describe('optional self-addressed Gmail backups', () => {
  const backup = createBackup(emptyJournal(), { uid: 'alice', email: 'alice@example.test' })
  const bytes = new Uint8Array([80, 75, 1, 2, 3])
  const authorization = {
    uid: 'alice',
    email: 'alice@example.test',
    accessToken: 'test-only-token',
  }
  it('encodes a MIME attachment addressed only to the signed-in owner', () => {
    const raw = buildBackupEmail('alice@example.test', backup, bytes)
    const decoded = atob(raw.replace(/-/g, '+').replace(/_/g, '/'))
    expect(decoded).toContain('To: <alice@example.test>')
    expect(decoded).toContain('From: <alice@example.test>')
    expect(decoded).toContain('Content-Disposition: attachment;')
    expect(decoded).toContain('UEsBAgM=')
    expect(decoded).not.toContain('test-only-token')
    expect(() =>
      buildBackupEmail('alice@example.test\r\nBcc: other@example.test', backup, bytes),
    ).toThrow()
  })
  it('uses send-only API access and rejects mismatched accounts before any request', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"id":"accepted"}', { status: 200 }))
    expect(await sendBackupEmail(authorization, backup, bytes, request)).toContain('accepted')
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][0]).toBe(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    )
    expect(request.mock.calls[0][1]?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer test-only-token' }),
    )
    await expect(
      sendBackupEmail({ ...authorization, uid: 'bob' }, backup, bytes, request),
    ).rejects.toThrow('must match')
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('reports unknown delivery after network errors without automatically retrying', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error('Disconnected'))
    await expect(sendBackupEmail(authorization, backup, bytes, request)).rejects.toThrow(
      'status is unknown',
    )
    expect(request).toHaveBeenCalledTimes(1)
    request.mockResolvedValue(new Response('', { status: 403 }))
    await expect(sendBackupEmail(authorization, backup, bytes, request)).rejects.toThrow(
      'download is still available',
    )
  })
})
