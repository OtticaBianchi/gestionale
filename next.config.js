/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ PERFORMANCE: Bundle optimization
  experimental: {
    optimizePackageImports: ['@supabase/ssr', 'lucide-react', 'date-fns']
  },
  
  // ✅ PERFORMANCE: Compressione immagini
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  
  // ✅ PERFORMANCE: Webpack optimizations (sicure)
  webpack: (config, { isServer }) => {
    // Ottimizza bundle splitting
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            chunks: 'all',
          },
          supabase: {
            test: /[\\/]node_modules[\\/]@supabase[\\/]/,
            name: 'supabase',
            priority: 20,
            chunks: 'all',
          },
        },
      };
    }
    return config;
  },

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
          // Content Security Policy (CSP) - CRITICO per sicurezza
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://nuzqczwjenhttnfdbpjp.supabase.co",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' https://nuzqczwjenhttnfdbpjp.supabase.co https://api.assemblyai.com wss://nuzqczwjenhttnfdbpjp.supabase.co",
              "img-src 'self' data: blob: https://nuzqczwjenhttnfdbpjp.supabase.co",
              "font-src 'self' data:",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; ')
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig