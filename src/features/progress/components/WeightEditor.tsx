import { useState } from 'react'
import { saveDatedEntity, type FitnessData } from '../../../data'
import { stamp, type Weight } from '../../../domain'
import { prettyDate, useAction } from '../../../shared'
import { Field, FormFooter, Modal } from '../../../shared/ui'

export function WeightEditor({
  data,
  initial,
  date,
  onClose,
}: {
  data: FitnessData
  initial?: Weight
  date: string
  onClose: () => void
}) {
  const [entry, setEntry] = useState<Weight>(initial ?? { ...stamp(), date, weight: 0 })
  const action = useAction()
  return (
    <Modal title={initial ? 'Edit body weight' : 'Log body weight'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void action.run(async () => {
            const existing = data.weights.find(
              (weight) => weight.date === entry.date && weight.id !== entry.id,
            )
            if (
              existing &&
              !window.confirm(`Replace the recorded weight for ${prettyDate(entry.date)}?`)
            )
              return
            await saveDatedEntity('weights', entry, initial, existing)
          }, onClose)
        }}
      >
        <Field label="Measurement date">
          <input
            required
            type="date"
            value={entry.date}
            onChange={(event) => setEntry({ ...entry, date: event.target.value })}
          />
        </Field>
        <Field label="Body weight (kg)">
          <input
            autoFocus
            required
            type="number"
            min="0.1"
            step="any"
            value={entry.weight || ''}
            onChange={(event) => setEntry({ ...entry, weight: Number(event.target.value) })}
          />
        </Field>
        <FormFooter {...action} onClose={onClose} label="Save weight" />
      </form>
    </Modal>
  )
}
