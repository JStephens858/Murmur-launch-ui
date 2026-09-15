/** Sticky column title, as at the top of each X timeline. */
export default function PortalPageHeader({
  title,
  leading,
  trailing,
}: {
  title: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="bg-background/85 border-border/40 sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 pr-14 backdrop-blur-md sm:pr-4">
      {leading}
      <h1 className="text-xl font-bold">{title}</h1>
      {trailing && (
        <div className="ml-auto flex items-center gap-2">{trailing}</div>
      )}
    </div>
  );
}

export function PortalPlaceholder({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground px-4 py-8">{children}</p>;
}
