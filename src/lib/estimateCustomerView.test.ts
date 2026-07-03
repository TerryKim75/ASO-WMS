import { describe, it, expect } from 'vitest'
import { toCustomerLineItems } from './estimateCustomerView'
import type { EstimateItem } from '../types'

const FORBIDDEN_FIELDS = ['execution_unit_cost', 'execution_total', 'margin_rate', 'supplier', 'memo']

function makeItem(overrides: Partial<EstimateItem> = {}): EstimateItem {
  return {
    id: '1',
    estimate_id: 'e1',
    category: '시스템 자재',
    name: '알루비젼 프레임',
    unit: 'EA',
    execution_unit_cost: 50_000,
    quantity: 2,
    margin_rate: 0.4,
    execution_total: 100_000,
    quoted_amount: 166_667,
    show_to_client: true,
    supplier: '어떤 공급처',
    memo: '내부 전용 메모',
    is_custom: false,
    sort_order: 1,
    created_at: '2026-01-01',
    ...overrides,
  }
}

describe('toCustomerLineItems', () => {
  it('excludes quantity=0 and show_to_client=false rows', () => {
    const items = [makeItem({ quantity: 0 }), makeItem({ id: '2', show_to_client: false }), makeItem({ id: '3' })]
    const result = toCustomerLineItems(items)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('3')
  })

  it('never leaks cost/margin/internal fields onto the mapped output', () => {
    const result = toCustomerLineItems([makeItem()])
    const keys = Object.keys(result[0])
    for (const forbidden of FORBIDDEN_FIELDS) {
      expect(keys).not.toContain(forbidden)
    }
  })
})
