import type { Metadata } from "next";
import { Suspense } from "react";

import Compose from "@/components/portal/compose";

export const metadata: Metadata = { title: "New post" };

// Suspense: the composer reads its mode (?group, ?quote, ?edit) from the URL
// with useSearchParams, which Next requires inside a boundary.
export default function ComposePage() {
  return (
    <Suspense>
      <Compose />
    </Suspense>
  );
}
