'use client'

import { useState, useEffect } from 'react'
import { CallList } from './CallList'
import { StatisticsDashboard } from './StatisticsDashboard'
import { GenerateListButton } from './GenerateListButton'
import { TabNavigation } from './TabNavigation'
import { useFollowUpData } from '../_hooks/useFollowUpData'

type ActiveTab = 'calls' | 'statistics'

export function FollowUpClient() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('calls')
  const {
    callList,
    statistics,
    isLoading,
    generateList,
    updateCall
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
          <GenerateListButton
            onGenerate={generateList}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'calls' ? (
          <CallList
            calls={callList}
            isLoading={isLoading}
            onUpdateCall={updateCall}
          />
        ) : (
          <StatisticsDashboard
            statistics={statistics}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  )
}