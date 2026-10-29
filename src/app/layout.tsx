import type { Metadata } from "next";
import "./globals.css";
import { GlobalDateRangeProvider } from "@/components/global-date-range-picker";
import { MouseReactiveShadows } from "@/components/mouse-reactive-shadows";
import { SidebarStateProvider } from "@/components/sidebar-state";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "RouteX | Profitability Analysis System",
  description: "Completed delivery records and profitability operations for RRLI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const routeGuard = `document.addEventListener('click',function(event){var link=event.target.closest('a[href="#overview"],a[href="#administration"],a[href="#settings"]');if(!link)return;event.preventDefault();event.stopPropagation();var href=link.getAttribute('href');window.location.assign(href==='#overview'?'/dashboard':href==='#settings'?'/settings':'/administration')},true);`;
  const themeInitializer = `try{if(localStorage.getItem('routex-theme')==='dark')document.documentElement.dataset.theme='dark'}catch(_){}`;
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeInitializer }} /><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600&display=swap" rel="stylesheet" /></head><body><script dangerouslySetInnerHTML={{ __html: routeGuard }} /><GlobalDateRangeProvider><SidebarStateProvider>{children}<ThemeToggle /><MouseReactiveShadows /></SidebarStateProvider></GlobalDateRangeProvider></body></html>;
}
