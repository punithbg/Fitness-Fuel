import { initialize } from '../repository'
import { demoDataService } from './DemoDataService'
import { activeRepository } from '../cloud/session'
import { expandDemo } from './expandDemo'
import { demoFixture } from './fixture'
import { today } from '../../domain'
export async function loadSampleData() {
  const cloud = activeRepository()
  if (cloud) {
    if (cloud.state.data?.demoLoaded) return
    const journal = await cloud.demoPlan(async () =>
      expandDemo(demoFixture, today(), await cloud.snapshot()),
    )
    await cloud.importJournal(journal, 'demo-two-week-v1')
    await cloud.markDemoLoaded()
    return
  }
  await initialize()
  await demoDataService.load()
}
