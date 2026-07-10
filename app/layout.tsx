import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/config/platform";
import { cn } from "@/lib/utils";
import { THEME_COOKIE, parseThemeCookie, resolvesToDarkOnServer } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: PRODUCT_NAME,
    template: `%s | ${PRODUCT_NAME}`,
  },
  description: PRODUCT_DESCRIPTION,
  icons: {
    icon: "/Kanbanica3.png",
    apple: "/Kanbanica3.png",
  },
};

// The `auto` appearance is the only case the server can't decide — it depends on
// the visitor's `prefers-color-scheme`. Everything else (the `dark` class and the
// `data-theme` palette) is already in the HTML below, so this script never runs
// for an explicit light/dark choice and there is nothing to flash.
const AUTO_APPEARANCE_SCRIPT = `(function(){try{
var el=document.documentElement;
if(el.dataset.appearance!=='auto')return;
var dark=window.matchMedia('(prefers-color-scheme: dark)').matches;
el.classList.toggle('dark',dark);
}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Mirrored from the DB on every theme save — see components/theme/theme-provider.tsx.
  const { theme, appearance } = parseThemeCookie(
    (await cookies()).get(THEME_COOKIE)?.value,
  );

  return (
    <html
      className={cn(
        "scroll-smooth font-sans",
        inter.variable,
        resolvesToDarkOnServer(appearance) && "dark",
      )}
      data-theme={theme}
      data-appearance={appearance}
      lang="en"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {/* A RAW <script>, not next/script. `strategy="beforeInteractive"` does
            not emit an executable inline script — it serialises the source into
            `self.__next_s` for the Next bootstrap to run *after* the framework
            JS loads, i.e. long after first paint. That is what made dark mode
            flash white. A plain script executes during HTML parse, before the
            page below it is painted. */}
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: static, non-user-controlled snippet that must run before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: AUTO_APPEARANCE_SCRIPT }} />
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
