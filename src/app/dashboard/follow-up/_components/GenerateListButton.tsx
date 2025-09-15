'use client'

interface GenerateListButtonProps {
  onGenerate: () => void
  isLoading: boolean
}

export function GenerateListButton({ onGenerate, isLoading }: GenerateListButtonProps) {
  return (
    <button
      onClick={onGenerate}
      disabled={isLoading}
      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
    >
      {isLoading ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span>Generando...</span>
        </>
      ) : (
        <>
          <span>🔄</span>
          <span>Genera Lista Follow-up</span>
        </>
      )}
    </button>
  )
}