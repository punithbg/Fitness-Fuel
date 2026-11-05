import { Apple, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { saveEntity, type FitnessData } from '../../../data'
import {
  calculateFoodNutrients,
  foodSnapshot,
  nutrientKeys,
  nutrientLabels,
  stamp,
  type Meal,
} from '../../../domain'
import { number, useAction } from '../../../shared'
import { Empty, Field, FormFooter, Modal } from '../../../shared/ui'

export function MealEditor({
  data,
  date,
  meal,
  categoryId,
  onClose,
}: {
  data: FitnessData
  date: string
  meal?: Meal
  categoryId?: string
  onClose: () => void
}) {
  const foods = data.foods
    .filter((food) => !food.archived)
    .sort(
      (left, right) =>
        Number(right.favorite) - Number(left.favorite) || left.name.localeCompare(right.name),
    )
  const [foodId, setFoodId] = useState(foods[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(
    meal?.categoryId ??
      categoryId ??
      data.categories.find((category) => !category.archived)?.id ??
      '',
  )
  const [selectedDate, setSelectedDate] = useState(meal?.date ?? date)
  const [time, setTime] = useState(meal?.time ?? '08:00')
  const [quantity, setQuantity] = useState(
    meal?.quantity ?? (foods[0]?.unit === 'serving' ? 1 : 100),
  )
  const [serving, setServing] = useState(false)
  const food = foods.find((item) => item.id === foodId)
  const action = useAction()
  const categories = data.categories.filter(
    (category) => !category.archived || category.id === meal?.categoryId,
  )
  let preview
  if (quantity > 0 && Number.isFinite(quantity))
    preview = meal
      ? calculateFoodNutrients(meal.basisNutrients, quantity, meal.basis)
      : food
        ? foodSnapshot(food, quantity, serving).nutrients
        : undefined
  return (
    <Modal title={meal ? 'Edit food entry' : 'Add food'} onClose={onClose}>
      {!meal && !foods.length ? (
        <Empty icon={<Apple />} title="Your food library is empty">
          <Link className="button" to="/library" onClick={onClose}>
            <Plus size={16} />
            New food
          </Link>
        </Empty>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void action.run(async () => {
              const category = data.categories.find((item) => item.id === selectedCategory)
              if (!category) throw new Error('Choose a meal category')
              if (!meal && !food) throw new Error('Choose a food')
              const snapshot = meal
                ? {
                    ...meal,
                    quantity,
                    nutrients: calculateFoodNutrients(meal.basisNutrients, quantity, meal.basis),
                  }
                : foodSnapshot(food!, quantity, serving)
              await saveEntity('meals', {
                ...stamp(),
                ...snapshot,
                date: selectedDate,
                time,
                categoryId: category.id,
                categoryName: meal?.categoryId === category.id ? meal.categoryName : category.name,
              })
            }, onClose)
          }}
        >
          {meal ? (
            <h3 className="entry-name">{meal.foodName}</h3>
          ) : (
            <>
              <Field label="Search foods">
                <input
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search your library"
                />
              </Field>
              <Field label="Food">
                <select
                  required
                  value={foodId}
                  onChange={(event) => {
                    const selected = foods.find((item) => item.id === event.target.value)!
                    setFoodId(selected.id)
                    setServing(false)
                    setQuantity(selected.unit === 'serving' ? 1 : 100)
                  }}
                >
                  {foods
                    .filter(
                      (item) =>
                        item.id === foodId ||
                        item.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.favorite ? '★ ' : ''}
                        {item.name}
                      </option>
                    ))}
                </select>
              </Field>
            </>
          )}
          <div className="form-grid">
            <Field label="Meal category">
              <select
                required
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.archived ? ' (archived)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quantity">
              <input
                required
                type="number"
                step="any"
                min="0.001"
                value={quantity || ''}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
            </Field>
            <Field label="Unit">
              <select
                value={serving ? 'serving' : 'base'}
                onChange={(event) => {
                  setServing(event.target.value === 'serving')
                  setQuantity(
                    event.target.value === 'serving' || food?.unit === 'serving' ? 1 : 100,
                  )
                }}
                disabled={!!meal}
              >
                <option value="base">
                  {meal?.unit ?? (food?.unit === 'serving' ? food.servingName : food?.unit)}
                </option>
                {!meal && food?.unit !== 'serving' && food?.servingSize && (
                  <option value="serving">
                    {food.servingName || 'serving'} ({food.servingSize} {food.unit})
                  </option>
                )}
              </select>
            </Field>
            <Field label="Meal date">
              <input
                required
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </Field>
            <Field label="Meal time">
              <input
                required
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </Field>
          </div>
          {preview && (
            <div className="nutrition-preview">
              {nutrientKeys.map((key) => (
                <div key={key}>
                  <span>{nutrientLabels[key]}</span>
                  <strong>
                    {number(preview[key], 1)} <small>{key === 'calories' ? 'kcal' : 'g'}</small>
                  </strong>
                </div>
              ))}
            </div>
          )}
          <FormFooter {...action} onClose={onClose} label="Save entry" />
        </form>
      )}
    </Modal>
  )
}
