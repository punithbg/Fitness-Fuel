import { useRef, useState } from 'react'
import { Download, Mail, Upload } from 'lucide-react'
import { getAdditionalUserInfo, GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth'
import { useAccount } from '../../auth/AuthContext'
import { activeRepository } from '../../../data/cloud/session'
import { firebaseServices } from '../../../data/cloud/firebase'
import {
  backupSummary,
  createBackup,
  MAX_BACKUP_BYTES,
  previewMerge,
  type Backup,
} from '../../../data/backup/model'
import { id } from '../../../domain'
import { readLocalJournal } from '../../../data/backup/legacy'
import type { MailAuthorization } from '../../../data/backup/gmail'
import { useAction } from '../../../shared'
import { ErrorMessage } from '../../../shared/ui'

type Artifact = { backup: Backup; bytes: Uint8Array<ArrayBuffer> }
export function BackupPanel() {
  const account = useAccount()
  const action = useAction()
  const input = useRef<HTMLInputElement>(null)
  const [artifact, setArtifact] = useState<Artifact>()
  const [preview, setPreview] = useState<Backup>()
  const [comparison, setComparison] = useState<ReturnType<typeof previewMerge>>()
  const [freshRestore, setFreshRestore] = useState(false)
  const [restoreId, setRestoreId] = useState(id)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState('')
  const [emailAttempted, setEmailAttempted] = useState(false)
  const summary = preview && backupSummary(preview.journal)

  function checkAccount() {
    if (account && firebaseServices().auth.currentUser?.uid !== account.uid)
      throw new Error('Account changed. Start a new export.')
  }

  async function prepare() {
    setMessage('')
    setProgress('Preparing a complete snapshot...')
    const cloud = activeRepository()
    const journal = cloud ? await cloud.snapshot() : await readLocalJournal()
    const backup = createBackup(journal, {
      uid: account?.uid ?? 'local',
      ...(account?.email ? { email: account.email } : {}),
    })
    const { encodeWorkbook } = await import('../../../data/backup/workbook')
    const result = { backup, bytes: await encodeWorkbook(backup) }
    checkAccount()
    setArtifact(result)
    setEmailAttempted(false)
    setProgress('')
    return result
  }
  async function authorize(): Promise<MailAuthorization> {
    if (!account?.email || !account.emailVerified)
      throw new Error('A verified Google email is required.')
    const provider = new GoogleAuthProvider()
    provider.addScope('https://www.googleapis.com/auth/gmail.send')
    provider.setCustomParameters({ login_hint: account.email })
    const result = await reauthenticateWithPopup(account, provider)
    const email = getAdditionalUserInfo(result)?.profile?.email
    const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken
    if (!token || result.user.uid !== account.uid || email !== account.email)
      throw new Error('Gmail permission must be granted by the signed-in Google account.')
    return { uid: account.uid, email: account.email, accessToken: token }
  }
  return (
    <section className="settings-section backup-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Emergency recovery</p>
          <h2>Journal backups</h2>
        </div>
        <Download size={22} />
      </div>
      <p className="muted">
        Backups cover the export time only. Keep a downloaded copy somewhere safe. Restore requires
        a working cloud connection.
      </p>
      <ErrorMessage error={action.error} />
      <div className="backup-actions">
        <button
          className="button secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              if (!account) return
              const result = await prepare()
              const { downloadWorkbook } = await import('../../../data/backup/workbook')
              downloadWorkbook(result.bytes, result.backup)
              setMessage('Backup ready. Confirm that your browser saved the download.')
            })
          }
        >
          <Download size={17} />
          Download Excel backup
        </button>
        {account && (
          <button
            className="button secondary"
            disabled={action.busy}
            onClick={() => {
              if (
                emailAttempted &&
                !window.confirm('Check Gmail Sent before sending another copy. Send again?')
              )
                return
              const authorization = authorize()
                .then((value) => ({ value }))
                .catch((error: unknown) => ({ error }))
              void action.run(async () => {
                const result = await prepare()
                const consent = await authorization
                if ('error' in consent) throw consent.error
                if (firebaseServices().auth.currentUser?.uid !== account.uid)
                  throw new Error('Account changed. Start a new export.')
                const { sendBackupEmail } = await import('../../../data/backup/gmail')
                setEmailAttempted(true)
                setMessage(await sendBackupEmail(consent.value, result.backup, result.bytes))
              })
            }}
          >
            <Mail size={17} />
            Export & email to me
          </button>
        )}
        <button
          className="button secondary"
          disabled={action.busy || !account}
          onClick={() => input.current?.click()}
        >
          <Upload size={17} />
          Import Excel backup
        </button>
        <input
          ref={input}
          aria-label="Choose Excel backup"
          hidden
          type="file"
          accept=".xlsx"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            setPreview(undefined)
            setComparison(undefined)
            setFreshRestore(false)
            setRestoreId(id())
            setMessage('')
            if (!file) return
            void action.run(async () => {
              if (file.size > MAX_BACKUP_BYTES)
                throw new Error('Choose a backup no larger than 20 MB.')
              const { decodeWorkbook } = await import('../../../data/backup/workbook')
              const backup = await decodeWorkbook(new Uint8Array(await file.arrayBuffer()))
              const cloud = activeRepository()
              if (!cloud) throw new Error('Cloud connection required for restore preview.')
              setComparison(previewMerge(await cloud.snapshot(), backup.journal))
              setPreview(backup)
            })
          }}
        />
      </div>
      {account?.email && <p className="muted account-address">Email recipient: {account.email}</p>}
      {account && (
        <button
          className="text-button"
          disabled={action.busy}
          onClick={() => window.dispatchEvent(new Event('fitness:local-import'))}
        >
          <Upload size={16} />
          Review existing browser data
        </button>
      )}
      {artifact && (
        <button
          className="text-button"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const { downloadWorkbook } = await import('../../../data/backup/workbook')
              downloadWorkbook(artifact.bytes, artifact.backup)
            })
          }
        >
          <Download size={16} />
          Download prepared backup ({new Date(artifact.backup.exportedAt).toLocaleString()})
        </button>
      )}
      {action.busy && progress && <p role="status">{progress}</p>}
      {message && <p role="status">{message}</p>}
      {preview && summary && (
        <div className="backup-preview">
          <h3>Restore preview</h3>
          <p>
            {summary.total} records | {summary.from ?? 'No dates'} to {summary.to ?? 'No dates'}
          </p>
          <p className="account-address">
            From: {preview.source.email ?? 'Local browser'} | To: {account?.email}
          </p>
          {preview.source.uid !== account?.uid && (
            <p className="form-error">
              This backup belongs to a different account or local browser. All restored records will
              belong to your signed-in account.
            </p>
          )}
          <dl className="settings-facts">
            {Object.entries(summary.counts).map(([table, count]) => (
              <div key={table}>
                <dt>{table}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          <p className="muted">
            Missing records are added. Existing conflicts are kept. Large imports use resumable
            batches, not one all-or-nothing operation.
          </p>
          {comparison && (
            <>
              <p>
                {comparison.added} missing, {comparison.skipped} identical,{' '}
                {comparison.conflicts.length} conflicts in the current cloud snapshot.
              </p>
              {comparison.conflicts.length > 0 && (
                <details>
                  <summary>Conflicts kept in cloud</summary>
                  <ul className="conflict-list">
                    {comparison.conflicts.slice(0, 100).map((conflict) => (
                      <li key={conflict}>{conflict}</li>
                    ))}
                  </ul>
                  {comparison.conflicts.length > 100 && (
                    <p>First 100 of {comparison.conflicts.length} conflicts shown.</p>
                  )}
                </details>
              )}
            </>
          )}
          <label className="restore-option">
            <input
              type="checkbox"
              checked={freshRestore}
              disabled={action.busy}
              onChange={(event) => setFreshRestore(event.target.checked)}
            />
            Restore records deleted after an earlier import
          </label>
          <button
            className="button"
            disabled={action.busy}
            onClick={() => {
              if (
                !window.confirm(
                  `Merge this backup into ${account?.email}? Existing conflicts will be kept.`,
                )
              )
                return
              void action.run(async () => {
                const cloud = activeRepository()
                if (!cloud) throw new Error('Cloud connection required for restore.')
                const result = await cloud.importJournal(
                  preview.journal,
                  `backup-${preview.id}${freshRestore ? `-${restoreId}` : ''}`,
                  (done, total) => setProgress(`Restored ${done} of ${total} records...`),
                )
                setMessage(
                  `Restore complete: ${result.added} added, ${result.skipped} identical, ${result.conflicts} conflicts kept.`,
                )
                setPreview(undefined)
                setProgress('')
              })
            }}
          >
            <Upload size={17} />
            Merge missing records
          </button>
          <button
            className="button secondary"
            disabled={action.busy}
            onClick={() => setPreview(undefined)}
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  )
}
