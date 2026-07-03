export const siteConfig = {
  name: "MurmurMD",
  // TODO: replace with the real production domain when decided
  url: "https://murmurmd.com",
  getStartedUrl: "/get-the-app",
  // TODO: replace with a MurmurMD-branded OG image
  ogImage: "/og.jpg",
  description:
    "MurmurMD is the professional community where physicians share cases, compare outcomes, query their peers, and learn from each other.",
  // TODO: real App Store link
  appStoreUrl: "#app-store",
  contactEmail: "contact@murmurmd.com",
  links: {
    email: "mailto:contact@murmurmd.com",
    // TODO: placeholders — swap for real profile URLs, prune unused platforms
    x: "https://x.com/murmurmd",
    linkedin: "https://www.linkedin.com/company/murmurmd",
    instagram: "https://www.instagram.com/murmurmd",
    facebook: "https://www.facebook.com/murmurmd",
    youtube: "https://www.youtube.com/@murmurmd",
    tiktok: "https://www.tiktok.com/@murmurmd",
  },
};

export type SiteConfig = typeof siteConfig;
