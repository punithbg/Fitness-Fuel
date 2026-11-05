import { Apple, Coffee, Copy, Moon, Pencil, Plus, Sun, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { copyMeals, removeEntity, type FitnessData } from '../../data'
import {
  goalsForDate,
  nutrientKeys,
  nutrientLabels,
  stamp,
  summarizeNutrition,
  today,
  type Meal,
} from '../../domain'
import { number, useAction } from '../../shared'
import {
  AddButton,
  ErrorMessage,
  Field,
  FormFooter,
  IconButton,
  Modal,
  PageTitle,
  Stat,
} from '../../shared/ui'
import { MealEditor } from './components/MealEditor'

export default function FoodDiary({ data, date }: { data: FitnessData; date: string }) {
  const [editor, setEditor] = useState<{ meal?: Meal; categoryId?: string } | null>(null)
  const [copy, setCopy] = useState<Meal[] | null>(null)
  const [destination, setDestination] = useState(today())
  const action = useAction()
  const copyAction = useAction()
  const meals = data.meals
    .filter((meal) => meal.date === date)
    .sort((left, right) => left.time.localeCompare(right.time))
  const totals = summarizeNutrition(meals)
  const goals = goalsForDate(data.goals, date)
  const categories = [...data.categories.filter((category) => !category.archived)]
  meals.forEach((meal) => {
    if (!categories.some((category) => category.id === meal.categoryId))
      categories.push({ ...stamp(), id: meal.categoryId, name: meal.categoryName, archived: true })
  })
  return (
    <>
      <PageTitle eyebrow="Nutrition journal" title="Food diary">
        <button
          className="button secondary"
          disabled={!meals.length}
          onClick={() => setCopy(meals)}
        >
          <Copy size={16} />
          Copy day
        </button>
        <AddButton onClick={() => setEditor({})}>Add food</AddButton>
      </PageTitle>
      <div className="stats-grid six">
        {nutrientKeys.map((key, index) => (
          <Stat
            key={key}
            label={nutrientLabels[key]}
            value={number(totals[key], key === 'calories' ? 0 : 1)}
            unit={key === 'calories' ? 'kcal' : 'g'}
            detail={
              goals
                ? `of ${number(goals[key])} ${key === 'calories' ? 'kcal' : 'g'}`
                : 'No target set'
            }
            tone={['green', 'coral', 'gold', 'blue', 'green', 'coral'][index]}
          />
        ))}
      </div>
      <ErrorMessage error={action.error} />
      <div className="meal-sections">
        {categories.map((category, index) => {
          const entries = meals.filter((meal) => meal.categoryId === category.id)
          const MealIcon = [Coffee, Sun, Moon, Apple][index % 4]
          return (
            <section className="meal-section" key={category.id}>
              <div className="section-heading">
                <div className="icon-heading">
                  <span className={`tile-icon ${['gold', 'coral', 'blue', 'green'][index % 4]}`}>
                    <MealIcon size={20} />
                  </span>
                  <div>
                    <h2>{category.name}</h2>
                    <span className="muted">
                      {entries.length
                        ? `${number(summarizeNutrition(entries).calories)} kcal`
                        : 'No entries'}
                    </span>
                  </div>
                </div>
                <div className="row-actions">
                  {entries.length > 0 && (
                    <IconButton label={`Copy ${category.name}`} onClick={() => setCopy(entries)}>
                      <Copy size={17} />
                    </IconButton>
                  )}
                  {!category.archived && (
                    <IconButton
                      label={`Add food to ${category.name}`}
                      onClick={() => setEditor({ categoryId: category.id })}
                    >
                      <Plus size={20} />
                    </IconButton>
                  )}
                </div>
              </div>
              {entries.length ? (
                <div className="food-table">
                  <div className="food-table-header">
                    <span>Food</span>
                    {nutrientKeys
                      .filter((key) => key !== 'calories')
                      .map((key) => (
                        <span key={key}>{nutrientLabels[key]}</span>
                      ))}
                    <span>Calories</span>
                    <span />
                  </div>
                  {entries.map((meal) => (
                    <div className="food-row" key={meal.id}>
                      <div className="food-name">
                        <strong>{meal.foodName}</strong>
                        <span>
                          {meal.quantity} {meal.unit} <span className="separator">·</span>{' '}
                          {meal.time}
                        </span>
                      </div>
                      {nutrientKeys
                        .filter((key) => key !== 'calories')
                        .map((key) => (
                          <span className="food-macro" key={key}>
                            <small>{nutrientLabels[key]} </small>
                            {number(meal.nutrients[key], 1)} g
                          </span>
                        ))}
                      <strong className="food-energy">
                        {number(meal.nutrients.calories)} <small>kcal</small>
                      </strong>
                      <div className="row-actions">
                        <IconButton
                          label={`Edit ${meal.foodName} entry`}
                          onClick={() => setEditor({ meal })}
                        >
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton
                          label={`Delete ${meal.foodName} entry`}
                          onClick={() => {
                            if (window.confirm('Delete this food entry?'))
                              void action.run(() => removeEntity('meals', meal.id))
                          }}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  className="empty-meal"
                  onClick={() => setEditor({ categoryId: category.id })}
                >
                  <Plus size={16} />
                  Add food
                </button>
              )}
            </section>
          )
        })}
      </div>
      {editor && <MealEditor data={data} date={date} {...editor} onClose={() => setEditor(null)} />}
      {copy && (
        <Modal
          title={copy.length === meals.length ? 'Copy food day' : 'Copy meal'}
          onClose={() => setCopy(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void copyAction.run(
                () => copyMeals(copy, destination),
                () => setCopy(null),
              )
            }}
          >
            <p>{copy.length} food entries</p>
            <Field label="Destination date">
              <input
                required
                type="date"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              />
            </Field>
            <FormFooter {...copyAction} onClose={() => setCopy(null)} label="Copy entries" />
          </form>
        </Modal>
      )}
    </>
  )
}
