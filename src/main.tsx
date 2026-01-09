import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { Loading } from '@/components/loading.tsx'
import ReactGA from 'react-ga4';

import './globals.ts'
import './index.css'

const LazyApp = lazy(() => import('./App'));

ReactGA.initialize("G-FHWK6KSLS3");

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<Loading />}>
      <LazyApp />
    </Suspense>
  </StrictMode>,
)
