'use client'

import { useState, useMemo } from 'react'

type Props = {
  src?: string | null
  alt?: string
  nameForFallback?: string
  size?: number
  className?: string
}

export default function AvatarImage({ src, alt = 'Avatar', nameForFallback = 'User', size = 32, className = '' }: Props) {
  const fallbackUrl = useMemo(() => {
    const name = encodeURIComponent(nameForFallback || 'User')
    return `https://ui-avatars.com/api/?name=${name}&background=random&size=${size}`
  }, [nameForFallback, size])

  const [currentSrc, setCurrentSrc] = useState<string>(src || fallbackUrl)

  return (
    <img
      src={currentSrc}
      alt={alt}
      width={size}
      height={size}
      className={className}
      onError={() => {
        if (currentSrc !== fallbackUrl) {
          setCurrentSrc(fallbackUrl)
        }
      }}
    />
  )
}

