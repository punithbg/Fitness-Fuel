import { useState } from 'react'
import { saveEntity, type FitnessData } from '../../../data'
import { stamp, type Category } from '../../../domain'
import { useAction } from '../../../shared'
import { Field, FormFooter, Modal } from '../../../shared/ui'

export function CategoryEditor({
  data,
  initial,
  onClose,
}: {
  data: FitnessData
  initial?: Category
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const action = useAction()
  return (
    <Modal title={initial ? 'Edit meal category' : 'New meal category'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void action.run(async () => {
            if (
              data.categories.some(
                (category) =>
                  !category.archived &&
                  category.id !== initial?.id &&
                  category.name.toLowerCase() === name.trim().toLowerCase(),
              )
            )
              throw new Error('This category already exists')
            await saveEntity('categories', {
              ...(initial ?? {
                ...stamp(),
                archived: false,
                order: Math.max(0, ...data.categories.map((category) => category.order ?? 0)) + 1,
              }),
              name,
            })
          }, onClose)
        }}
      >
        <Field label="Category name">
          <input
            autoFocus
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Post-workout"
          />
        </Field>
        <FormFooter {...action} onClose={onClose} label="Save category" />
      </form>
    </Modal>
  )
}
