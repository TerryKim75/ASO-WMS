import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const source = process.argv[2]
if (!source) throw new Error('Usage: node scripts/import-marketing-research.mjs <research-directory>')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = async name => JSON.parse(await fs.readFile(path.join(source, name), 'utf8'))
const events = await read('events_ready.json')
const research = await read('workbook_companies.json')
const stats = await read('stats_final.json')
const normalized = value => value.normalize('NFKC').toLowerCase().replace(/주식회사|\(주\)|㈜|유한회사|[^a-z0-9가-힣]/g, '')
const stableId = value => createHash('sha256').update(value).digest('hex').slice(0, 32)
const companies = research.companies.map(({ description, ...c }) => ({
  ...c, id: stableId(normalized(c.name) + '|' + (c.website.split(';')[0] || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')),
}))
if (new Set(companies.map(c => c.id)).size !== companies.length) throw new Error('Company identity collision: review import')
const companyIds = new Map(companies.map(c => [c.company_id, c.id]))
// Reviewed mappings for this snapshot. Unmapped shows remain visible without a guessed join.
const eventMap = {'KORMARINE|2025':'EX0366','ENTECH|2025':'EX0308','ENTECH|2026':'EX1349',
  'CI KOREA 2026':'EX0718','COPHEX 2026':'EX0715','ESG PACK 2026':'EX0716','KOREA CHEM 2026':'EX0714',
  'KOREA COLD CHAIN 2026':'EX0717','KOREA LAB 2026':'EX0720','KOREA MAT 2026':'EX0719','KOREA PACK 2026':'EX0721',
  'KOREA PHARM&BIO 2026':'EX0713','인코스메틱스 코리아 2026':'EX1085','인터참코리아 2026':'EX1086'}
const participations = research.participation.map((p, i) => ({
  id: `participation-${i + 1}`, companyId: companyIds.get(p.company_id), company_id: p.company_id, name: p.name,
  year: p.year, show: p.show, booth: p.booth, products: p.products, status: p.status,
  country: p.country, source: p.source, source_list: p.source_list, note: p.note,
  eventId: eventMap[p.show.includes('KORMARINE') ? `KORMARINE|${p.year}` : p.show.includes('ENTECH') ? `ENTECH|${p.year}` : p.show] || null,
}))
const eventIds = new Set(events.map(e => e.event_id))
if (participations.some(p => !p.companyId || (p.eventId && !eventIds.has(p.eventId)))) throw new Error('Broken research relation')
const dataset = {schemaVersion: 1, version: '2026-09-19', events, companies, participations, stats, coverage: research.coverage, audit: research.audit}
const dir = path.join(root, 'public/marketing')
await fs.mkdir(dir, {recursive: true})
await fs.writeFile(path.join(dir, 'research.json'), JSON.stringify(dataset))
console.log(`Imported ${events.length} events, ${companies.length} companies, ${participations.length} participation records`)
