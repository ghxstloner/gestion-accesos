import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageSkeleton({
  variant = "table",
  className,
}: {
  variant?: "table" | "detail" | "settings" | "dashboard";
  className?: string;
}) {
  return (
    <div
      className={cn("animate-in fade-in space-y-6", className)}
      aria-label="Cargando contenido"
      aria-busy="true"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56 rounded-xl" />
          <Skeleton className="h-4 w-72 max-w-full rounded-lg" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      {variant === "table" && <TableBodySkeleton />}
      {variant === "detail" && <DetailBodySkeleton />}
      {variant === "settings" && <SettingsBodySkeleton />}
      {variant === "dashboard" && <DashboardBodySkeleton />}
    </div>
  );
}

function TableBodySkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border-subtle p-4 sm:flex-row">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl sm:w-40" />
      </div>
      <div className="grid grid-cols-[1.4fr_1fr_.8fr_72px] gap-4 bg-brand-600 px-4 py-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-3 rounded bg-white/25" />
        ))}
      </div>
      <div className="divide-y divide-border-subtle">
        {Array.from({ length: 7 }).map((_, row) => (
          <div
            key={row}
            className="grid grid-cols-[1.4fr_1fr_.8fr_72px] items-center gap-4 px-4 py-4"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
              <Skeleton className="h-4 w-32 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-28 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="ml-auto h-8 w-8 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailBodySkeleton() {
  return (
    <>
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-3 w-44 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, card) => (
          <div
            key={card}
            className="rounded-2xl border border-border bg-white p-6"
          >
            <Skeleton className="mb-6 h-6 w-44 rounded-lg" />
            <div className="grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-5 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SettingsBodySkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {Array.from({ length: 3 }).map((_, card) => (
        <div
          key={card}
          className="rounded-2xl border border-border bg-white p-6"
        >
          <Skeleton className="mb-6 h-6 w-48 rounded-lg" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardBodySkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-border bg-white p-5"
          >
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="mt-4 h-9 w-16 rounded-lg" />
            <Skeleton className="mt-3 h-3 w-32 rounded" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </>
  );
}

export function AppBootSkeleton() {
  return (
    <div
      className="flex h-[100dvh] overflow-hidden bg-background"
      aria-label="Preparando aplicación"
      aria-busy="true"
    >
      <aside className="hidden w-60 shrink-0 bg-brand-600 p-3 lg:block">
        <Skeleton className="h-20 w-full rounded-xl bg-white/85" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-10 w-full rounded-xl bg-white/15"
            />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border bg-white px-4">
          <Skeleton className="h-9 w-16 rounded-lg" />
          <Skeleton className="hidden h-4 w-36 rounded md:block" />
          <Skeleton className="ml-auto h-10 w-64 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        <main className="flex-1 overflow-hidden p-5 sm:p-7">
          <PageSkeleton />
        </main>
      </div>
    </div>
  );
}
