import type { Metadata } from "next";

import Footer from "@/components/sections/footer/default";
import Navbar from "@/components/sections/navbar/default";
import VideosBrowser from "@/components/sections/videos/browser";
import { getPublicVideos, type PublicVideosPage } from "@/lib/murmur-api";

export const metadata: Metadata = {
  title: "Videos",
  description:
    "Long-form conversations with physicians and short clips from the MurmurMD community — watch them here or in the app.",
};

export const revalidate = 300;

export default async function VideosPage() {
  let page: PublicVideosPage | null = null;
  let loadError = false;
  try {
    page = await getPublicVideos({ longCount: 30, shortCount: 30 });
  } catch {
    loadError = true;
  }

  return (
    <main className="text-foreground min-h-screen w-full">
      <Navbar />
      <section className="max-w-container mx-auto flex flex-col gap-8 px-4 py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold sm:text-4xl">Videos</h1>
          <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">
            Long-form conversations with physicians and short clips from the
            MurmurMD community. Watch them here, or in the app.
          </p>
        </div>
        {loadError || !page ? (
          <p className="text-muted-foreground">
            Videos are temporarily unavailable — please check back in a few
            minutes.
          </p>
        ) : (
          <VideosBrowser
            longVideos={page.longVideos}
            shortVideos={page.shortVideos}
          />
        )}
      </section>
      <Footer />
    </main>
  );
}
