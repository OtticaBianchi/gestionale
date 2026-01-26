'use client'

import { useState, useEffect } from 'react'
import { CallList } from './CallList'
import { StatisticsDashboard } from './StatisticsDashboard'
import { EnhancedStatisticsDashboard } from './EnhancedStatisticsDashboard'
import { GenerateListButton } from './GenerateListButton'
import { TabNavigation } from './TabNavigation'
import { useFollowUpData } from '../_hooks/useFollowUpData'

type ActiveTab = 'calls' | 'statistics' | 'enhanced-stats'

export function FollowUpClient() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('calls')
  const {
    callList,
    statistics,
    isLoading,
    hasGeneratedOnce,
    generateList,
    updateCall,
    cleanupCompletedCalls
  } = useFollowUpData()

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === 'calls' && (
          <div className="flex space-x-2">
            <button
              onClick={cleanupCompletedCalls}
              className="px-3 py-2 text-sm font-medium text-orange-700 bg-orange-100 rounded-md hover:bg-orange-200 transition-colors"
              title="Rimuovi chiamate completate visibili"
            >
              🧹 Pulisci
            </button>
            <GenerateListButton
              onGenerate={generateList}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'calls' ? (
          <CallList
            calls={callList}
            isLoading={isLoading}
            showArchiveEmptyMessage={hasGeneratedOnce}
            onUpdateCall={updateCall}
          />
        ) : activeTab === 'statistics' ? (
          <StatisticsDashboard
            statistics={statistics}
            isLoading={isLoading}
          />
        ) : (
          <EnhancedStatisticsDashboard />
        )}
      </div>
    </div>
  )
}
