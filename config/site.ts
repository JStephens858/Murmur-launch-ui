export const siteConfig = {
  name: "MurmurMD",
  // TODO: replace with the real production domain when decided
  url: "https://murmurmd.com",
  getStartedUrl: "/get-the-app",
  // TODO: replace with a MurmurMD-branded OG image
  ogImage: "/og.jpg",
  description:
    "MurmurMD is the professional community where physicians share cases, compare outcomes, query their peers, and learn from each other.",
  appStoreUrl:
    "https://apps.apple.com/app/apple-store/id1586692687?pt=123231498&ct=homepage&mt=8",
  contactEmail: "contact@murmurmd.com",
  xHandle: "@Murmur_MD",
  links: {
    email: "mailto:contact@murmurmd.com",
    x: "https://x.com/Murmur_MD",
    linkedin: "https://www.linkedin.com/company/murmur-md/",
    youtube: "https://www.youtube.com/@MurmurMD",
  },
};

export type SiteConfig = typeof siteConfig;
