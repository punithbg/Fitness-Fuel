import { Download, Plus, Search, Pencil, Star, Trash2, Upload, RotateCcw } from 'lucide-react'
import { useDeferredValue, useRef, useState } from 'react'
import { removeEntity, saveEntity, type FitnessData } from '../../data'
import { id, nutrientKeys, nutrientLabels, type Food } from '../../domain'
import { activeRepository } from '../../data/cloud/session'
import type { CloudRepository } from '../../data/cloud/CloudRepository'
import {
  createFoodDirectory,
  decodeFoodDirectory,
  foodJournal,
  type FoodDirectory as DirectoryFile,
} from '../../data/backup/foods'
import { MAX_BACKUP_BYTES, previewMerge } from '../../data/backup/model'
import { starterFoods } from '../../data/foods/starter'
import { number, useAction } from '../../shared'
import { Empty, ErrorMessage, IconButton, PageTitle } from '../../shared/ui'
import { useAccount } from '../auth/AuthContext'
import { FoodEditor } from './components/FoodEditor'

type ImportPreview = {
  directory: DirectoryFile
  comparison: ReturnType<typeof previewMerge>
  repository: CloudRepository
  operation: string
}

export default function FoodDirectory({ data }: { data: FitnessData }) {
  const account = useAccount()
  const action = useAction()
  const input = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'mine' | 'starter'>('starter')
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('')
  const [preparation, setPreparation] = useState('')
  const [favorites, setFavorites] = useState(false)
  const [archived, setArchived] = useState(false)
  const [editor, setEditor] = useState<Food | 'new' | null>(null)
  const [preview, setPreview] = useState<ImportPreview>()
  const [message, setMessage] = useState('')
  const query = useDeferredValue(search.trim().toLowerCase())
  const source = tab === 'starter' ? starterFoods : data.foods
  const groups = [...new Set(source.map((food) => food.category || 'Other'))].sort()
  const preparations = [...new Set(source.map((food) => food.preparation || 'Unspecified'))].sort()
  const foods = source
    .filter(
      (food) =>
        (archived || !food.archived) &&
        (!favorites || food.favorite) &&
        (!group || (food.category || 'Other') === group) &&
        (!preparation || (food.preparation || 'Unspecified') === preparation) &&
        `${food.name} ${food.category ?? ''} ${food.preparation ?? ''}`
          .toLowerCase()
          .includes(query),
    )
    .sort((left, right) => left.name.localeCompare(right.name))
  const existingIds = new Set(data.foods.map((food) => food.id))

  function repository() {
    const cloud = activeRepository()
    if (!cloud) throw new Error('Sign in to manage your food directory.')
    return cloud
  }

  async function prepareImport(directory: DirectoryFile, cloud: CloudRepository) {
    const current = await cloud.snapshot()
    setPreview({
      directory,
      repository: cloud,
      operation: `foods-${id()}`,
      comparison: previewMerge(foodJournal(current.foods), foodJournal(directory.foods)),
    })
  }

  function download(directory: DirectoryFile) {
    const text = JSON.stringify(directory, null, 2)
    if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
      throw new Error('Food directory exceeds the 20 MB export limit.')
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `fitness-and-fuel-foods-${tab}-${directory.exportedAt.slice(0, 10)}.json`
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  return (
    <>
      <PageTitle eyebrow="Nutrition reference" title="Food directory">
        <button
          className="button"
          disabled={!account || action.busy}
          onClick={() => setEditor('new')}
        >
          <Plus size={17} />
          New food
        </button>
      </PageTitle>
      <div className="directory-toolbar">
        <div className="tabs" role="tablist" aria-label="Food directory source">
          {(['starter', 'mine'] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => {
                setTab(value)
                setGroup('')
                setPreparation('')
                setFavorites(false)
                setArchived(false)
              }}
            >
              {value === 'starter' ? 'Starter foods' : 'My foods'}
            </button>
          ))}
        </div>
        <div className="directory-actions">
          {tab === 'starter' && (
            <button
              className="button secondary"
              disabled={!account || action.busy}
              onClick={() => {
                setMessage('')
                void action.run(() =>
                  prepareImport(createFoodDirectory(starterFoods), repository()),
                )
              }}
            >
              <Plus size={17} />
              Add starter foods
            </button>
          )}
          <button
            className="button secondary"
            disabled={action.busy || (tab === 'mine' && !account)}
            onClick={() => {
              setMessage('')
              void action.run(async () => {
                const foods =
                  tab === 'starter' ? starterFoods : (await repository().snapshot()).foods
                download(createFoodDirectory(foods))
                setMessage('Food directory download ready.')
              })
            }}
          >
            <Download size={17} />
            {tab === 'starter' ? 'Export starter DB' : 'Export my food DB'}
          </button>
          <button
            className="button secondary"
            disabled={!account || action.busy}
            onClick={() => input.current?.click()}
          >
            <Upload size={17} />
            Import food DB
          </button>
        </div>
      </div>
      <input
        ref={input}
        hidden
        type="file"
        accept=".json,application/json"
        aria-label="Choose food directory"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          setPreview(undefined)
          setMessage('')
          if (!file) return
          void action.run(async () => {
            const cloud = repository()
            if (file.size > MAX_BACKUP_BYTES)
              throw new Error('Choose a food directory no larger than 20 MB.')
            await prepareImport(decodeFoodDirectory(await file.text()), cloud)
          })
        }}
      />
      <ErrorMessage error={action.error} />
      {message && <p role="status">{message}</p>}
      {action.busy && <p role="status">Processing food directory...</p>}
      {preview && (
        <section className="directory-import" aria-label="Food import preview">
          <h2>Food import preview</h2>
          <p>
            {preview.directory.foods.length} foods | {preview.comparison.added} missing |{' '}
            {preview.comparison.skipped} identical | {preview.comparison.conflicts.length} conflicts
            kept
          </p>
          <p className="muted account-address">
            Destination: {account?.email}. Existing foods and diary entries are kept.
          </p>
          {preview.comparison.conflicts.length > 0 && (
            <details>
              <summary>Conflicting foods</summary>
              <ul className="conflict-list">
                {preview.comparison.conflicts.slice(0, 100).map((conflict) => (
                  <li key={conflict}>{conflict}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="directory-actions">
            <button
              className="button"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  const result = await preview.repository.importJournal(
                    foodJournal(preview.directory.foods),
                    preview.operation,
                  )
                  setMessage(
                    `Food import complete: ${result.added} added, ${result.skipped} identical, ${result.conflicts} conflicts kept.`,
                  )
                  setPreview(undefined)
                  setTab('mine')
                  setSearch('')
                  setGroup('')
                  setPreparation('')
                  setFavorites(false)
                  setArchived(false)
                })
              }
            >
              <Upload size={17} />
              Merge foods into my library
            </button>
            <button
              className="button secondary"
              disabled={action.busy}
              onClick={() => setPreview(undefined)}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
      <div className="directory-filters">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search food directory"
            placeholder="Search foods"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          Food group
          <select value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="">All groups</option>
            {groups.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Preparation
          <select value={preparation} onChange={(event) => setPreparation(event.target.value)}>
            <option value="">All preparations</option>
            {preparations.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        {tab === 'mine' && (
          <>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={favorites}
                onChange={(event) => setFavorites(event.target.checked)}
              />
              Favorites
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={archived}
                onChange={(event) => setArchived(event.target.checked)}
              />
              Include archived
            </label>
          </>
        )}
      </div>
      <p className="muted">
        {foods.length} {foods.length === 1 ? 'food' : 'foods'}
        {tab === 'starter' ? ' | Approximate reference values; edible portions only.' : ''}
      </p>
      {foods.length ? (
        <div
          className="directory-table-scroll"
          role="region"
          aria-label="Food nutrient table"
          tabIndex={0}
        >
          <table className="directory-table">
            <thead>
              <tr>
                <th scope="col">Food / portion</th>
                {nutrientKeys.map((key) => (
                  <th scope="col" key={key}>
                    {nutrientLabels[key]}
                    <small>{key === 'calories' ? 'kcal' : 'g'}</small>
                  </th>
                ))}
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {foods.map((food) => (
                <tr key={food.id}>
                  <th scope="row">
                    <strong>{food.name}</strong>
                    {food.archived && <span className="badge">Archived</span>}
                    <span className="directory-food-meta">
                      {food.category || 'Other'} | {food.preparation || 'Unspecified'} | Per{' '}
                      {food.basis} {food.unit === 'serving' ? food.servingName : food.unit}
                    </span>
                    <details>
                      <summary>Portion & source</summary>
                      {food.servingSize && (
                        <p>
                          1 {food.servingName || 'serving'} = {food.servingSize} {food.unit}
                        </p>
                      )}
                      {food.notes && <p>{food.notes}</p>}
                      <p>{food.source || 'User-provided nutrition values.'}</p>
                    </details>
                  </th>
                  {nutrientKeys.map((key) => (
                    <td
                      key={key}
                      data-label={`${nutrientLabels[key]} (${key === 'calories' ? 'kcal' : 'g'})`}
                    >
                      {number(food.nutrients[key], key === 'calories' ? 0 : 2)}
                    </td>
                  ))}
                  <td>
                    <div className="row-actions">
                      {tab === 'starter' ? (
                        <IconButton
                          label={
                            existingIds.has(food.id)
                              ? `${food.name} already in library`
                              : `Add ${food.name} to my foods`
                          }
                          disabled={!account || action.busy || existingIds.has(food.id)}
                          onClick={() =>
                            void action.run(async () => {
                              const result = await repository().importJournal(
                                foodJournal([food]),
                                `foods-${id()}`,
                              )
                              setMessage(
                                `${result.added} food added; ${result.skipped + result.conflicts} already present.`,
                              )
                            })
                          }
                        >
                          <Plus size={17} />
                        </IconButton>
                      ) : (
                        <>
                          <IconButton
                            label={`${food.favorite ? 'Unfavorite' : 'Favorite'} ${food.name}`}
                            disabled={!account || action.busy}
                            onClick={() =>
                              void action.run(() =>
                                saveEntity('foods', { ...food, favorite: !food.favorite }),
                              )
                            }
                          >
                            <Star size={17} fill={food.favorite ? 'currentColor' : 'none'} />
                          </IconButton>
                          <IconButton
                            label={`Edit ${food.name}`}
                            disabled={!account || action.busy}
                            onClick={() => setEditor(food)}
                          >
                            <Pencil size={17} />
                          </IconButton>
                          <IconButton
                            label={`${food.archived ? 'Restore' : 'Archive'} ${food.name}`}
                            disabled={!account || action.busy}
                            onClick={() => {
                              if (food.archived)
                                void action.run(() =>
                                  saveEntity('foods', { ...food, archived: false }),
                                )
                              else if (
                                window.confirm(`Archive ${food.name}? Past logs will be kept.`)
                              )
                                void action.run(() => removeEntity('foods', food.id))
                            }}
                          >
                            {food.archived ? <RotateCcw size={17} /> : <Trash2 size={17} />}
                          </IconButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No matching foods" />
      )}
      {editor && (
        <FoodEditor
          food={editor === 'new' ? undefined : editor}
          onClose={() => {
            setEditor(null)
            setTab('mine')
          }}
        />
      )}
    </>
  )
}
