'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Upload, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CameraCaptureProps {
  /**
   * Called when the user confirms the captured/uploaded image. The Blob is a
   * JPEG/PNG ready to POST to /credentials/:id/photo with `source` matching
   * whether it was captured via webcam or uploaded as a fallback.
   */
  onCapture: (file: Blob, source: 'CAPTURED' | 'UPLOADED') => void | Promise<void>;
  /** Optional preview URL when an existing photo is already attached. */
  existingPreviewUrl?: string | null;
  /** Disable interactions while a parent mutation is in-flight. */
  disabled?: boolean;
}

type Mode = 'idle' | 'streaming' | 'captured' | 'uploaded';

/**
 * WebRTC camera capture with file-upload fallback. Used in the issuance
 * workspace to attach a photograph to a credential. No vendor SDK: pure
 * navigator.mediaDevices.getUserMedia + canvas.toBlob.
 */
export function CameraCapture({
  onCapture,
  existingPreviewUrl,
  disabled,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    existingPreviewUrl ?? null,
  );
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingSource, setPendingSource] = useState<
    'CAPTURED' | 'UPLOADED' | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  const startCamera = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no soporta captura por cámara.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 600 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode('streaming');
      setPreviewUrl(null);
      setPendingBlob(null);
      setPendingSource(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo acceder a la cámara';
      setError(`${message}. Usa la opción de subir un archivo.`);
    }
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = video.videoWidth || 480;
    const height = video.videoHeight || 600;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPendingBlob(blob);
        setPendingSource('CAPTURED');
        setPreviewUrl(URL.createObjectURL(blob));
        setMode('captured');
        stopStream();
      },
      'image/jpeg',
      0.92,
    );
  }, [stopStream]);

  const retake = useCallback(() => {
    setPendingBlob(null);
    setPendingSource(null);
    setPreviewUrl(null);
    void startCamera();
  }, [startCamera]);

  const confirm = useCallback(async () => {
    if (!pendingBlob || !pendingSource) return;
    await onCapture(pendingBlob, pendingSource);
    setMode('idle');
    setPendingBlob(null);
    setPendingSource(null);
  }, [onCapture, pendingBlob, pendingSource]);

  const cancelCapture = useCallback(() => {
    setPendingBlob(null);
    setPendingSource(null);
    setPreviewUrl(null);
    setMode('idle');
    stopStream();
  }, [stopStream]);

  const handleFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WebP.');
      return;
    }
    setError(null);
    setPendingBlob(file);
    setPendingSource('UPLOADED');
    setPreviewUrl(URL.createObjectURL(file));
    setMode('uploaded');
    stopStream();
  }, [stopStream]);

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-input bg-muted">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Vista previa"
            className="h-full w-full object-cover"
          />
        ) : mode === 'streaming' ? (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Camera className="h-10 w-10" />
            <p className="text-sm">Sin fotografía</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex flex-wrap gap-2">
        {mode === 'idle' && (
          <>
            <Button
              type="button"
              variant="default"
              onClick={startCamera}
              disabled={disabled}
            >
              <Camera className="mr-2 h-4 w-4" />
              Activar cámara
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              <Upload className="mr-2 h-4 w-4" />
              Subir archivo
            </Button>
          </>
        )}

        {mode === 'streaming' && (
          <>
            <Button type="button" onClick={capture} disabled={disabled}>
              <Camera className="mr-2 h-4 w-4" />
              Capturar
            </Button>
            <Button type="button" variant="outline" onClick={cancelCapture}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          </>
        )}

        {(mode === 'captured' || mode === 'uploaded') && (
          <>
            <Button
              type="button"
              onClick={confirm}
              disabled={disabled || !pendingBlob}
            >
              <Check className="mr-2 h-4 w-4" />
              Confirmar {
                pendingSource === 'CAPTURED' ? 'captura' : 'archivo'
              }
            </Button>
            {mode === 'captured' ? (
              <Button type="button" variant="outline" onClick={retake}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Repetir
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Cambiar archivo
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={cancelCapture}>
              <X className="mr-2 h-4 w-4" />
              Descartar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
