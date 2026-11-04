'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import PreventivoForm from './_components/PreventivoForm'

// Modulo indipendente: nessun legame con buste, Kanban o dashboard.
export default function PreventiviPage() {
  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-4 pb-16 sm:p-6 sm:pb-16">
          <h1 className="mb-1 text-3xl font-bold text-slate-900">Preventivi</h1>
          <p className="mb-5 text-base text-slate-600">
            Crea un preventivo e scaricalo in PDF per stamparlo o inviarlo al cliente.
          </p>
          <PreventivoForm />
        </div>
      </div>
    </DashboardLayout>
  )
}
