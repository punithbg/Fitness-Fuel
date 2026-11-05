import { Database, Download, HardDrive, Palette, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { resetWorkspace, removeEntity, type FitnessData } from '../../data'
import { loadSampleData } from '../../data/demo/loadSampleData'
import { nutrientKeys, nutrientLabels, type Category, type Goal } from '../../domain'
import { number, prettyDate, useAction } from '../../shared'
import { AddButton, ErrorMessage, IconButton, PageTitle } from '../../shared/ui'
import { CategoryEditor } from './components/CategoryEditor'
import { GoalsEditor } from './components/GoalsEditor'
import { ThemeSelector } from '../../theme/ThemeControls'
import { useAccount } from '../auth/AuthContext'
import { BackupPanel } from './components/BackupPanel'

export default function Settings({ data }: { data: FitnessData }) {
  const account = useAccount()
  const [goalEditor, setGoalEditor] = useState<Goal | 'new' | null>(null)
  const [categoryEditor, setCategoryEditor] = useState<Category | 'new' | null>(null)
  const action = useAction()
  const categories = data.categories.filter((category) => !category.archived)
  return (
    <>
      <PageTitle eyebrow="Personal preferences" title="Settings" />
      <ErrorMessage error={action.error} />
      <section className="settings-section appearance-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Appearance</p>
            <h2>Your workspace</h2>
          </div>
          <Palette size={22} />
        </div>
        <ThemeSelector />
        <div className="palette-swatches" aria-label="Orange, coral, amber, and lavender palette">
          <span className="swatch primary" />
          <span className="swatch coral" />
          <span className="swatch amber" />
          <span className="swatch lavender" />
        </div>
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nutrition</p>
            <h2>Daily goals</h2>
          </div>
          <AddButton onClick={() => setGoalEditor('new')}>Set goals</AddButton>
        </div>
        {!data.goals.length && <p className="muted">No nutrition goals set.</p>}
        {[...data.goals]
          .sort((left, right) => right.date.localeCompare(left.date))
          .map((goal) => (
            <div className="goal-row" key={goal.id}>
              <div>
                <strong>From {prettyDate(goal.date)}</strong>
                <div className="goal-values">
                  {nutrientKeys.map((key) => (
                    <span key={key}>
                      {nutrientLabels[key]}{' '}
                      <b>
                        {number(goal.nutrients[key])}
                        {key === 'calories' ? ' kcal' : ' g'}
                      </b>
                    </span>
                  ))}
                </div>
              </div>
              <div className="row-actions">
                <IconButton label={`Edit goals ${goal.date}`} onClick={() => setGoalEditor(goal)}>
                  <Pencil size={16} />
                </IconButton>
                <IconButton
                  label={`Delete goals ${goal.date}`}
                  onClick={() => {
                    if (
                      window.confirm('Delete these goals? Earlier goals will apply to this period.')
                    )
                      void action.run(() => removeEntity('goals', goal.id))
                  }}
                >
                  <Trash2 size={16} />
                </IconButton>
              </div>
            </div>
          ))}
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Food diary</p>
            <h2>Meal categories</h2>
          </div>
          <AddButton secondary onClick={() => setCategoryEditor('new')}>
            New category
          </AddButton>
        </div>
        {categories.map((category) => (
          <div className="list-row" key={category.id}>
            <strong>{category.name}</strong>
            <div className="row-actions">
              <IconButton
                label={`Edit ${category.name} category`}
                onClick={() => setCategoryEditor(category)}
              >
                <Pencil size={16} />
              </IconButton>
              <IconButton
                label={`Archive ${category.name} category`}
                disabled={categories.length <= 1}
                onClick={() => {
                  if (window.confirm('Archive this category? Existing entries will be kept.'))
                    void action.run(() => removeEntity('categories', category.id))
                }}
              >
                <Trash2 size={16} />
              </IconButton>
            </div>
          </div>
        ))}
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>{account ? 'Cloud data' : 'Demo data'}</h2>
          </div>
          <HardDrive size={22} />
        </div>
        <p className="storage-notice">
          {account
            ? `Private journal for ${account.email}. Submitted changes save automatically to Firebase. An internet connection is required.`
            : 'Two weeks of fictional sample records. Your personal journal appears after signing in.'}
        </p>
        <dl className="settings-facts">
          <div>
            <dt>Weight units</dt>
            <dd>Kilograms</dd>
          </div>
          <div>
            <dt>Week starts</dt>
            <dd>Monday</dd>
          </div>
          <div>
            <dt>Calendar</dt>
            <dd>Local device dates</dd>
          </div>
          <div>
            <dt>Gym calorie entry</dt>
            <dd>Manual</dd>
          </div>
        </dl>
        <div className="data-action">
          <div>
            <h3>Two-week sample workspace</h3>
            <p className="muted">
              14 days of fictional meals, 8 workouts, and daily body measurements ending today.
              Nutrition values are illustrative. Existing records are kept.
            </p>
          </div>
          <button
            className="button secondary"
            disabled={data.demoLoaded || action.busy}
            onClick={() => {
              if (
                window.confirm(
                  'Add fictional sample records to this journal? Existing records will be kept.',
                )
              )
                void action.run(loadSampleData)
            }}
          >
            <Database size={17} />
            {data.demoLoaded ? 'Sample data added' : 'Load sample data'}
          </button>
        </div>
        <a className="text-button" href="/data/two-week-demo.json" download="two-week-demo.json">
          <Download size={17} />
          Download two-week JSON
        </a>
        <div className="data-action danger-zone">
          <div>
            <h3>{account ? 'Clear cloud journal' : 'Clear journal'}</h3>
            <p className="muted">
              {account
                ? 'Permanently remove records from this account on every connected device. Local originals are kept. Large resets run in batches.'
                : 'Sign in to manage your personal journal. The preview does not change browser or cloud records.'}
            </p>
          </div>
          <button
            className="button danger"
            disabled={action.busy || !account}
            onClick={() => {
              if (
                window.confirm(
                  `Permanently delete ALL journal records ${account ? `for ${account.email}` : 'in this browser'}? Download a backup first. This cannot be undone.`,
                )
              )
                void action.run(resetWorkspace)
            }}
          >
            <Trash2 size={16} />
            Clear all data
          </button>
        </div>
      </section>
      <BackupPanel />
      {goalEditor && (
        <GoalsEditor
          data={data}
          initial={goalEditor === 'new' ? undefined : goalEditor}
          onClose={() => setGoalEditor(null)}
        />
      )}
      {categoryEditor && (
        <CategoryEditor
          data={data}
          initial={categoryEditor === 'new' ? undefined : categoryEditor}
          onClose={() => setCategoryEditor(null)}
        />
      )}
    </>
  )
}
