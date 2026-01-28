'use client'

/**
 * Global error boundary for the entire application.
 * Handles errors during build and runtime.
 * Must include html and body tags per Next.js requirements.
 *
 * Note: Uses inline styles and <img> (not Next/Image) because this
 * renders when the app is broken - we can't rely on components or CSS.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error(error)
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, sans-serif',
            padding: '1rem',
            backgroundColor: '#fafafa',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            {/* 또리 apologizing */}
            <img
              src="/ttori/empty-error.png"
              alt="Ttori bowing apologetically"
              style={{
                width: '160px',
                height: '160px',
                objectFit: 'contain',
                marginBottom: '1.5rem',
              }}
            />
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem',
                color: '#1a1a2e',
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                color: '#666',
                marginBottom: '1.5rem',
                fontSize: '0.875rem',
              }}
            >
              We encountered an unexpected error. Please try again.
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#1a1a2e',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
