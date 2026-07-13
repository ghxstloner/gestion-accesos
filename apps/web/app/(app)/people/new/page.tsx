'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { useSgaStore } from '@/lib/store';
import { PageHeader } from '@/components/shared/PageHeader';
import { PersonForm } from '@/components/shared/PersonForm';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export default function NewPersonPage() {
  const router = useRouter();
  const addPerson = useSgaStore((s) => s.addPerson);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva persona"
        description="Registro de una persona asociada a una empresa"
        actions={<Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>}
      />

      <div className="rounded-xl border border-border bg-surface p-6">
        <PersonForm
          onSubmit={(payload) => {
            const p = addPerson(payload);
            return p.id;
          }}
          onSaved={(id) => {
            toast({ title: 'Persona registrada' });
            router.push(`/people/${id}`);
          }}
        />
        <div className="mt-6 flex justify-end gap-2 border-t border-border-subtle pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" form="person-form"><Save className="mr-2 h-4 w-4" />Guardar persona</Button>
        </div>
      </div>
    </div>
  );
}
