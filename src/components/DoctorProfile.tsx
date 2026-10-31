type DoctorProfileProps = {
  compact?: boolean;
};

const PORTRAIT = "/dr-saqlain-portrait.webp";

export function DoctorProfile({ compact = false }: DoctorProfileProps) {
  if (compact) {
    return (
      <div className="mt-3 flex items-center justify-center gap-3 rounded-xl border bg-card/80 px-3 py-2.5 shadow-sm">
        <img
          src={PORTRAIT}
          alt="Dr. Saqlain Abbas Chattha"
          width={64}
          height={64}
          className="size-14 shrink-0 rounded-full object-cover ring-2 ring-secondary/30"
        />
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold text-foreground">
            Dr. Saqlain Abbas Chattha
          </p>
          <p className="text-xs text-muted-foreground">Al Shifa Family Clinic</p>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Clinic doctor"
      className="mb-5 overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="flex items-center gap-4 border-l-4 border-l-secondary p-3 sm:p-4">
        <img
          src={PORTRAIT}
          alt="Dr. Saqlain Abbas Chattha"
          width={96}
          height={96}
          loading="lazy"
          className="size-20 shrink-0 rounded-xl object-cover ring-1 ring-border sm:size-24"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            Al Shifa Family Clinic
          </p>
          <h2 className="mt-1 text-base font-bold text-primary sm:text-lg">
            Dr. Saqlain Abbas Chattha
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Family clinic care and pharmacy services.
          </p>
        </div>
      </div>
    </section>
  );
}
