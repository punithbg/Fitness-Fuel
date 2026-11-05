import { useEffect, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { db } from '../../data/database'
import { readLocalJournal } from '../../data/backup/legacy'
import { backupSummary, createBackup } from '../../data/backup/model'
import { digest } from '../../data/backup/model'
import { activeRepository } from '../../data/cloud/session'
import type { Journal } from '../../data/schemas'
import { useAccount } from './AuthContext'
import { ErrorMessage, Modal } from '../../shared/ui'
import { useAction } from '../../shared'

export function LocalImportPrompt() {
  const account = useAccount()
  const [journal, setJournal] = useState<Journal>()
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const action = useAction()
  useEffect(() => {
    const open = () => setAttempt((value) => value + 1)
    window.addEventListener('fitness:local-import', open)
    return () => window.removeEventListener('fitness:local-import', open)
  }, [])
  useEffect(() => {
    if (!account) return
    let cancelled = false
    void (async () => {
      const association = await db.meta.get('cloud-import-owner')
      const dismissed = await db.meta.get(`cloud-import-dismissed:${account.uid}`)
      if (!attempt && ((association && association.value !== account.uid) || dismissed)) return
      const snapshot = await readLocalJournal()
      const meaningful = Object.entries(backupSummary(snapshot).counts).some(
        ([table, count]) => table !== 'categories' && count > 0,
      )
      if (!cancelled && meaningful) setJournal(snapshot)
      else if (!cancelled && attempt) setMessage('No existing browser journal records were found.')
    })().catch(() => {
      if (!cancelled)
        setMessage(
          'Existing browser storage could not be inspected. No local records were changed.',
        )
    })
    return () => {
      cancelled = true
    }
  }, [account, attempt])
  if (!account) return null
  if (!journal) return message ? <p role="status">{message}</p> : null
  const summary = backupSummary(journal)
  const close = () => {
    if (action.busy) return
    void action.run(async () => {
      await db.meta.put({ key: `cloud-import-dismissed:${account.uid}`, value: '1' })
      setJournal(undefined)
    })
  }
  return (
    <Modal title="Existing browser journal" onClose={close}>
      <p>
        {summary.total} local records, {summary.from ?? 'undated'} to {summary.to ?? 'undated'}.
      </p>
      <p className="account-address">Import into {account.email}?</p>
      {Object.values(journal).some((rows) => rows.some((row) => row.id.startsWith('demo-'))) && (
        <p className="muted">Includes fictional sample records.</p>
      )}
      <p className="muted">The originals stay on this device. Existing cloud conflicts are kept.</p>
      <ErrorMessage error={action.error} />
      <div className="backup-actions">
        <button
          className="button"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              if (
                !window.confirm(
                  `Import the existing browser journal into ${account.email}? This browser may contain another person's local records.`,
                )
              )
                return
              const cloud = activeRepository()
              if (!cloud || cloud.uid !== account.uid)
                throw new Error('Account changed. Sign in again.')
              await db.meta.put({ key: 'cloud-import-owner', value: account.uid })
              const operation = `local-${digest(JSON.stringify(journal))}`
              const result = await cloud.importJournal(journal, operation)
              await db.meta.put({ key: `cloud-import-dismissed:${account.uid}`, value: '1' })
              setMessage(
                `Local import complete: ${result.added} added; ${result.conflicts} cloud conflicts kept.`,
              )
              setJournal(undefined)
            })
          }
        >
          <Upload size={17} />
          Import into this account
        </button>
        <button
          className="button secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const backup = createBackup(journal, { uid: 'local' })
              const { encodeWorkbook, downloadWorkbook } =
                await import('../../data/backup/workbook')
              downloadWorkbook(await encodeWorkbook(backup), backup)
            })
          }
        >
          <Download size={17} />
          Download local backup
        </button>
        <button className="button secondary" disabled={action.busy} onClick={close}>
          Skip import
        </button>
      </div>
    </Modal>
  )
}
