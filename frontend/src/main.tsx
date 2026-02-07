import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { PostHogProvider } from 'posthog-js/react'
import './index.css'
import App from './App.tsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable')
}

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined

const posthogOptions = {
  api_host: posthogHost,
  defaults: '2025-11-30',
} as const

const app = (
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </StrictMode>
)

createRoot(document.getElementById('root')!).render(
  posthogKey
    ? <PostHogProvider apiKey={posthogKey} options={posthogOptions}>{app}</PostHogProvider>
    : app,
)
