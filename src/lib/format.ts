export function formatKRW(n: number): string {
  return Math.round(n).toLocaleString('ko-KR') + '원'
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}
