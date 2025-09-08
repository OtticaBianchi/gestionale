'use client'

export default function ErrorActions() {
  return (
    <div className="mt-3 flex space-x-2">
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
      >
        Ricarica Pagina
      </button>
      <a
        href="/login"
        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
      >
        Torna al Login
      </a>
    </div>
  )
}

