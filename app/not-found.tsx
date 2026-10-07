// Global 404 for routes outside [locale] (e.g. invalid locale prefixes).
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>404</h1>
            <p style={{ color: '#666', marginTop: '0.5rem' }}>Page not found</p>
          </div>
        </div>
      </body>
    </html>
  )
}
