'use client'

interface TabNavigationProps {
  activeTab: 'calls' | 'statistics' | 'enhanced-stats'
  onTabChange: (tab: 'calls' | 'statistics' | 'enhanced-stats') => void
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs = [
    { id: 'calls' as const, label: 'Lista Chiamate', icon: '📞' },
    { id: 'statistics' as const, label: 'Statistiche Base', icon: '📊' },
    { id: 'enhanced-stats' as const, label: 'Statistiche Avanzate', icon: '📈' }
  ]

  return (
    <nav className="flex space-x-8">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center space-x-2 pb-2 px-1 border-b-2 font-medium text-sm ${
            activeTab === tab.id
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}