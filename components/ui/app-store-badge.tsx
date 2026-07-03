import Image from "next/image";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Official Apple "Download on the App Store" badge (black, en-US).
 * Per Apple's marketing guidelines the artwork must not be modified;
 * size via height only to preserve the aspect ratio.
 */
export default function AppStoreBadge({ className }: { className?: string }) {
  return (
    <a
      href={siteConfig.appStoreUrl}
      aria-label="Download on the App Store"
      className={cn("inline-flex shrink-0", className)}
    >
      <Image
        src="/app-store-badge.svg"
        alt="Download on the App Store"
        width={120}
        height={40}
        className="h-11 w-auto"
      />
    </a>
  );
}
