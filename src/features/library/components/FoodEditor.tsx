import { useForm, useWatch } from 'react-hook-form'
import { saveEntity } from '../../../data'
import { nutrientKeys, nutrientLabels, stamp, zeroNutrients, type Food } from '../../../domain'
import { useAction } from '../../../shared'
import { Field, FormFooter, Modal } from '../../../shared/ui'

export function FoodEditor({ food, onClose }: { food?: Food; onClose: () => void }) {
  const { register, handleSubmit, control, setValue } = useForm<Food>({
    defaultValues: food ?? {
      ...stamp(),
      name: '',
      unit: 'g',
      basis: 100,
      servingName: '',
      nutrients: zeroNutrients(),
      favorite: false,
      archived: false,
    },
  })
  const unit = useWatch({ control, name: 'unit' })
  const action = useAction()
  return (
    <Modal title={food ? 'Edit food' : 'New food'} onClose={onClose}>
      <form
        onSubmit={handleSubmit((value) => {
          void action.run(
            () =>
              saveEntity('foods', {
                ...value,
                servingSize: value.unit === 'serving' ? undefined : value.servingSize,
              }),
            onClose,
          )
        })}
      >
        <Field label="Food name">
          <input
            autoFocus
            required
            maxLength={120}
            {...register('name')}
            placeholder="e.g. Rolled oats"
          />
        </Field>
        <div className="form-grid">
          <Field label="Food group">
            <input maxLength={80} {...register('category')} list="food-groups" />
            <datalist id="food-groups">
              {[
                'Fruit',
                'Vegetable',
                'Chicken',
                'Fish',
                'Mutton',
                'Egg',
                'Grain',
                'Legume',
                'Dairy',
              ].map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
          </Field>
          <Field label="Preparation">
            <input
              maxLength={120}
              {...register('preparation')}
              placeholder="e.g. Raw, boiled, roasted"
            />
          </Field>
        </div>
        <Field label="Portion notes">
          <textarea maxLength={2000} {...register('notes')} />
        </Field>
        <Field label="Nutrition source">
          <input maxLength={500} {...register('source')} />
        </Field>
        <div className="form-grid">
          <Field label="Nutrition unit">
            <select
              {...register('unit', {
                onChange: (event) => {
                  setValue('basis', event.target.value === 'serving' ? 1 : 100)
                },
              })}
            >
              <option value="g">Grams (g)</option>
              <option value="ml">Milliliters (ml)</option>
              <option value="serving">Named serving</option>
            </select>
          </Field>
          <Field label={`Nutrition per (${unit})`}>
            <input
              required
              type="number"
              min="0.001"
              step="any"
              {...register('basis', { valueAsNumber: true })}
            />
          </Field>
        </div>
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
                {...register(`nutrients.${key}`, { valueAsNumber: true })}
              />
            </Field>
          ))}
        </div>
        <div className="form-grid">
          <Field label={unit === 'serving' ? 'Serving name' : 'Serving name (optional)'}>
            <input
              required={unit === 'serving'}
              maxLength={80}
              {...register('servingName')}
              placeholder="e.g. scoop, egg, glass"
            />
          </Field>
          {unit !== 'serving' && (
            <Field label={`One serving equals (${unit}, optional)`}>
              <input
                type="number"
                min="0.001"
                step="any"
                {...register('servingSize', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
              />
            </Field>
          )}
        </div>
        <label className="checkbox">
          <input type="checkbox" {...register('favorite')} />
          Favorite food
        </label>
        <FormFooter {...action} onClose={onClose} label="Save food" />
      </form>
    </Modal>
  )
}
