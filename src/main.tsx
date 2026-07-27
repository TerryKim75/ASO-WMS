import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

// 렌더링 외부(이벤트 핸들러, Promise)에서 발생하는 에러는 ErrorBoundary가 잡지 못하므로
// 콘솔에 명확히 남겨 다음 발생 시 원인을 바로 확인할 수 있게 한다.
window.addEventListener('error', (e) => {
  console.error('[Uncaught error]', e.error ?? e.message)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled promise rejection]', e.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
