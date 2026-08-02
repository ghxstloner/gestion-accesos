'use client';

import { useMemo } from 'react';
import { API_BASE_URL } from '@/lib/api-config';
import { Printer, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAccessToken } from '@/lib/auth-session';

export interface PrintPreviewProps {
  credentialId: string;
  /** Tall (default) or compact preview height. */
  height?: number;
}

/**
 * Embeds the backend-rendered print-ready HTML in an iframe. The credential
 * print view contains its own window.print() button so end-users have a
 * single click to print; here we also surface an external Open + a quick
 * Print button that triggers the iframe print.
 *
 * Authenticated by appending the bearer token via postMessage-less approach:
 * browsers don't allow Authorization headers for top-level navigations, so
 * we fall back to the same-origin cookie path used by openapi-fetch.
 */
export function PrintPreview({
  credentialId,
  height = 520,
}: PrintPreviewProps) {
  const src = useMemo(
    () => `${API_BASE_URL}/credentials/${credentialId}/print`,
    [credentialId],
  );

  const handlePrint = () => {
    const iframe = document.getElementById(
      `print-iframe-${credentialId}`,
    ) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.print();
    } catch {
      window.open(src, '_blank');
    }
  };

  const handleOpen = () => {
    // Hint developers if the iframe failed: in dev the cookie path is enough
    // because credentials: 'include' is used by the API client. For top-level
    // navigation we still need the cookie.
    void getAccessToken();
    window.open(src, '_blank', 'noopener');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Vista previa lista para imprimir. Usa el botón para enviar a tu impresora.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleOpen}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir
          </Button>
          <Button type="button" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>
      <iframe
        id={`print-iframe-${credentialId}`}
        title={`Credencial ${credentialId}`}
        src={src}
        style={{ height, width: '100%' }}
        className="rounded-lg border border-input bg-white"
      />
    </div>
  );
}
