import { PortalNavigationTracker } from "@/components/portal/back-button";
import PortalMobileNav from "@/components/portal/mobile-nav";
import PortalQueryProvider from "@/components/portal/query-provider";
import PortalSidebar from "@/components/portal/sidebar";

/**
 * Physician portal shell. Three columns like X: sticky navigation on the
 * left, a 600px content column, and a right rail that is empty for now.
 * The proxy redirects signed-out visitors to /login before any of this
 * renders; pages still verify the session when they fetch data.
 */
export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <PortalQueryProvider>
      <div className="text-foreground mx-auto flex min-h-dvh w-full max-w-[1265px] justify-center">
        <PortalSidebar />
        <main className="border-border/40 w-full max-w-[600px] min-w-0 pb-24 sm:border-x sm:pb-0">
          {children}
        </main>
        <aside className="hidden w-[350px] shrink-0 lg:block" />
        <PortalMobileNav />
        <PortalNavigationTracker />
      </div>
    </PortalQueryProvider>
  );
}
