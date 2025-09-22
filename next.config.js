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
  
  // ✅ FIX: Non bloccare la build per errori ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ✅ PERFORMANCE & STABILITY: Webpack optimizations with dev stability fixes
  webpack: (config, { dev, isServer }) => {
    // In development, disable aggressive caching that causes vendors.js corruption
    if (dev && !isServer) {
      // Disable webpack cache in development to prevent file corruption
      config.cache = false
      
      // Keep default Next.js chunk splitting but disable caching
      // Don't override splitChunks to avoid 404s
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        // Keep default but ensure no caching issues
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
        }
      }
    } else if (!isServer) {
      // Production optimizations (keep existing)
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
    const headers = [
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
            value: 'geolocation=(), camera=(), payment=(), usb=(), bluetooth=(), microphone=(self)',
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
    ]
    
    // Add development-specific headers to prevent JS file caching issues
    if (process.env.NODE_ENV === 'development') {
      headers.push(
        {
          source: '/_next/static/chunks/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-cache, no-store, must-revalidate',
            },
            {
              key: 'Pragma',
              value: 'no-cache',
            },
            {
              key: 'Expires',
              value: '0',
            },
          ],
        },
        {
          source: '/_next/static/css/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-cache, no-store, must-revalidate',
            },
          ],
        }
      )
    }
    
    return headers
  },
}

module.exports = nextConfig