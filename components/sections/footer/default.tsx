import { ReactNode } from "react";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

import MurmurMD from "../../logos/murmurmd";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  XIcon,
  YouTubeIcon,
} from "../../logos/social";
import {
  Footer,
  FooterBottom,
  FooterColumn,
  FooterContent,
} from "../../ui/footer";
import { ModeToggle } from "../../ui/mode-toggle";

interface FooterLink {
  text: string;
  href: string;
}

interface FooterColumnProps {
  title: string;
  links: FooterLink[];
}

interface SocialLink {
  name: string;
  href: string;
  icon: ReactNode;
}

interface FooterProps {
  logo?: ReactNode;
  name?: string;
  columns?: FooterColumnProps[];
  socialLinks?: SocialLink[];
  copyright?: string;
  policies?: FooterLink[];
  showModeToggle?: boolean;
  className?: string;
}

const SOCIAL_ICON_CLASS = "size-5";

export default function FooterSection({
  logo = <MurmurMD className="h-6" />,
  name = "",
  columns = [
    {
      title: "Explore",
      links: [
        { text: "Physicians", href: "/physicians" },
        { text: "Partners", href: "/partners" },
        { text: "Video Library", href: "/videos" },
        { text: "About", href: "/about" },
      ],
    },
    {
      title: "Get the App",
      links: [
        { text: "iOS App Store", href: siteConfig.appStoreUrl },
        { text: "Physician verification", href: "/get-the-app" },
      ],
    },
    {
      title: "Contact",
      links: [
        { text: siteConfig.contactEmail, href: siteConfig.links.email },
        {
          text: "Partner inquiries",
          href: `${siteConfig.links.email}?subject=Partner%20inquiry`,
        },
      ],
    },
  ],
  socialLinks = [
    { name: "X", href: siteConfig.links.x, icon: <XIcon className={SOCIAL_ICON_CLASS} /> },
    { name: "LinkedIn", href: siteConfig.links.linkedin, icon: <LinkedInIcon className={SOCIAL_ICON_CLASS} /> },
    { name: "Instagram", href: siteConfig.links.instagram, icon: <InstagramIcon className={SOCIAL_ICON_CLASS} /> },
    { name: "Facebook", href: siteConfig.links.facebook, icon: <FacebookIcon className={SOCIAL_ICON_CLASS} /> },
    { name: "YouTube", href: siteConfig.links.youtube, icon: <YouTubeIcon className={SOCIAL_ICON_CLASS} /> },
    { name: "TikTok", href: siteConfig.links.tiktok, icon: <TikTokIcon className={SOCIAL_ICON_CLASS} /> },
  ],
  copyright = "© 2026 MurmurMD. All rights reserved",
  policies = [
    { text: "Privacy Policy", href: "#" },
    { text: "Terms of Service", href: "#" },
  ],
  showModeToggle = true,
  className,
}: FooterProps) {
  return (
    <footer className={cn("bg-background w-full px-4", className)}>
      <div className="max-w-container mx-auto">
        <Footer>
          <FooterContent>
            <FooterColumn className="col-span-2 gap-4 sm:col-span-3 md:col-span-1">
              <div className="flex items-center gap-2">
                {logo}
                {name && <h3 className="text-xl font-bold">{name}</h3>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </FooterColumn>
            {columns.map((column) => (
              <FooterColumn key={column.title}>
                <h3 className="text-md pt-1 font-semibold">{column.title}</h3>
                {column.links.map((link) => (
                  <a
                    key={`${link.href}-${link.text}`}
                    href={link.href}
                    className="text-muted-foreground text-sm"
                  >
                    {link.text}
                  </a>
                ))}
              </FooterColumn>
            ))}
          </FooterContent>
          <FooterBottom>
            <div>{copyright}</div>
            <div className="flex items-center gap-4">
              {policies.map((policy) => (
                <a key={`${policy.href}-${policy.text}`} href={policy.href}>
                  {policy.text}
                </a>
              ))}
              {showModeToggle && <ModeToggle />}
            </div>
          </FooterBottom>
        </Footer>
      </div>
    </footer>
  );
}
