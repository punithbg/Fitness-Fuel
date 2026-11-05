import { useState } from 'react'
import { saveDatedEntity, type FitnessData } from '../../../data'
import {
  goalsForDate,
  nutrientKeys,
  nutrientLabels,
  stamp,
  today,
  zeroNutrients,
  type Goal,
} from '../../../domain'
import { useAction } from '../../../shared'
import { Field, FormFooter, Modal } from '../../../shared/ui'

export function GoalsEditor({
  data,
  initial,
  onClose,
}: {
  data: FitnessData
  initial?: Goal
  onClose: () => void
}) {
  const [goal, setGoal] = useState(
    initial ?? {
      ...stamp(),
      date: today(),
      nutrients: goalsForDate(data.goals, today()) ?? zeroNutrients(),
    },
  )
  const action = useAction()
  return (
    <Modal title={initial ? 'Edit goals' : 'Set daily goals'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void action.run(async () => {
            const existing = data.goals.find(
              (item) => item.date === goal.date && item.id !== goal.id,
            )
            if (existing && !window.confirm('Replace the goals for this effective date?')) return
            await saveDatedEntity('goals', goal, initial, existing)
          }, onClose)
        }}
      >
        <Field label="Effective from">
          <input
            required
            type="date"
            value={goal.date}
            onChange={(event) => setGoal({ ...goal, date: event.target.value })}
          />
        </Field>
        <div className="form-grid">
          {nutrientKeys.map((key) => (
            <Field
              key={key}
              label={`${nutrientLabels[key]} (${key === 'calories' ? 'kcal' : 'g'})`}
            >
              <input
                required
                type="number"
                min="0"
                step="any"
                value={goal.nutrients[key]}
                onChange={(event) =>
                  setGoal({
                    ...goal,
                    nutrients: { ...goal.nutrients, [key]: Number(event.target.value) },
                  })
                }
              />
            </Field>
          ))}
        </div>
        <FormFooter {...action} onClose={onClose} label="Save goals" />
      </form>
    </Modal>
  )
}
