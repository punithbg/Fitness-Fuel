import { useForm } from 'react-hook-form'
import { saveEntity } from '../../../data'
import { stamp, type Exercise } from '../../../domain'
import { useAction } from '../../../shared'
import { Field, FormFooter, Modal } from '../../../shared/ui'

export function ExerciseEditor({
  exercise,
  onClose,
}: {
  exercise?: Exercise
  onClose: () => void
}) {
  const { register, handleSubmit } = useForm<Exercise>({
    defaultValues: exercise ?? { ...stamp(), name: '', muscle: '', notes: '', archived: false },
  })
  const action = useAction()
  return (
    <Modal title={exercise ? 'Edit exercise' : 'New exercise'} onClose={onClose}>
      <form
        onSubmit={handleSubmit((value) => {
          void action.run(() => saveEntity('exercises', value), onClose)
        })}
      >
        <Field label="Exercise name">
          <input
            autoFocus
            required
            maxLength={120}
            {...register('name')}
            placeholder="e.g. Bench press"
          />
        </Field>
        <Field label="Muscle group">
          <input
            required
            maxLength={120}
            {...register('muscle')}
            placeholder="e.g. Chest"
            list="muscles"
          />
          <datalist id="muscles">
            {['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full body'].map((muscle) => (
              <option key={muscle}>{muscle}</option>
            ))}
          </datalist>
        </Field>
        <Field label="Notes">
          <textarea rows={3} maxLength={2000} {...register('notes')} />
        </Field>
        <FormFooter {...action} onClose={onClose} label="Save exercise" />
      </form>
    </Modal>
  )
}
