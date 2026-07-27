import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: ErrorInfo | null
}

const LAST_ERROR_KEY = 'aso_wms_last_error'

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info })
    try {
      localStorage.setItem(LAST_ERROR_KEY, JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        time: new Date().toISOString(),
        url: location.href,
      }))
    } catch {
      // localStorage 저장 실패는 무시 (에러 화면 표시가 우선)
    }
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800">문제가 발생했습니다</h1>
              <p className="text-sm text-slate-500">작성 중인 내용이 저장되지 않았을 수 있습니다.</p>
            </div>
          </div>

          <button
            onClick={() => location.reload()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
          >
            <RefreshCw size={15} />새로고침
          </button>

          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer hover:text-slate-600 select-none">오류 상세 (개발자에게 전달용)</summary>
            <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg overflow-auto max-h-56 whitespace-pre-wrap break-all">
              {error.message}
              {'\n'}
              {error.stack}
              {info?.componentStack}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
