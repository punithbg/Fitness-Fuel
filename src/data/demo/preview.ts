import { today } from '../../domain'
import { emptyJournal, type FitnessData } from '../schemas'
import { demoFixture } from './fixture'
import { expandDemo } from './expandDemo'

export function createDemoPreview(endDate = today()): FitnessData {
  return { ...expandDemo(demoFixture, endDate, emptyJournal()), demoLoaded: true }
}