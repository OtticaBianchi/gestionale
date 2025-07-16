/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ SECURITY: Headers di sicurezza per proteggere l'app
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Previene embedding in iframe (clickjacking)
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Previene MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Protezione XSS base
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Controllo referrer per privacy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permessi ristretti per funzionalità browser
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), bluetooth=()',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig