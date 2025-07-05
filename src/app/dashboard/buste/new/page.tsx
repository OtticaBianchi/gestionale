// app/dashboard/buste/new/page.tsx

import MultiStepBustaForm from '@/app/dashboard/_components/MultiStepBustaForm';

export default function NewBustaPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Crea Nuova Busta
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Inserisci i dettagli della nuova lavorazione. I campi obbligatori sono segnati con *.
        </p>
      </header>
      
      <main>
        {/* Il form vero e proprio sarà in un Client Component separato */}
        <MultiStepBustaForm />
      </main>
    </div>
  );
}