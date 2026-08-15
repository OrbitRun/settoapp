import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-2 py-14 text-center">
      <p className="text-[17px] font-medium tracking-tight">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-[26ch] text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
