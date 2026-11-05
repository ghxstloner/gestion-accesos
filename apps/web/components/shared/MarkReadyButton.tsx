'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/shared/DatePicker';
import { useCredentialTransitionMutation } from '@/hooks/api-workflow-hooks';
import { toast } from '@/hooks/use-toast';

export const DEFAULT_PICKUP_LOCATION = 'Ventanilla 3';

/**
 * "Marcar lista" action. Every card marked ready gets a specific pickup date
 * (and window, "Ventanilla 3" by default) that is notified to the applicant.
 */
export function MarkReadyButton({
  credentialId,
  disabled,
  label = 'Marcar lista',
}: {
  credentialId: string;
  disabled?: boolean;
  label?: string;
}) {
  const mutation = useCredentialTransitionMutation(credentialId);
  const [open, setOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState('');
  const [pickupLocation, setPickupLocation] = useState(DEFAULT_PICKUP_LOCATION);
  const today = format(new Date(), 'yyyy-MM-dd');
  const isValidDate = Boolean(pickupDate) && pickupDate >= today;

  const submit = () => {
    if (!isValidDate) return;
    mutation.mutate(
      {
        transition: 'mark_ready',
        // Noon Panama time keeps the calendar day stable across time zones.
        pickupScheduledAt: `${pickupDate}T12:00:00-05:00`,
        pickupLocation: pickupLocation.trim() || DEFAULT_PICKUP_LOCATION,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Credencial lista para retiro',
            description: `Retiro asignado para el ${pickupDate} en ${pickupLocation.trim() || DEFAULT_PICKUP_LOCATION}`,
          });
          setOpen(false);
        },
        onError: (error) =>
          toast({
            title: 'No se pudo marcar lista',
            description: error instanceof Error ? error.message : undefined,
            variant: 'destructive',
          }),
      },
    );
  };

  return (
    <>
      <Button
        size="sm"
        disabled={disabled || mutation.isPending}
        onClick={() => {
          setPickupDate('');
          setPickupLocation(DEFAULT_PICKUP_LOCATION);
          setOpen(true);
        }}
      >
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar fecha de retiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Se notificará al solicitante la fecha y el lugar para retirar el carné.
            </p>
            <div className="space-y-1.5">
              <Label>
                Fecha de retiro <span className="text-danger">*</span>
              </Label>
              <DatePicker value={pickupDate} onChange={setPickupDate} placeholder="Seleccione la fecha" />
              {pickupDate && !isValidDate && (
                <p className="text-xs text-danger">La fecha no puede estar en el pasado.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Lugar de retiro</Label>
              <Input
                value={pickupLocation}
                maxLength={120}
                onChange={(e) => setPickupLocation(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={!isValidDate || mutation.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
