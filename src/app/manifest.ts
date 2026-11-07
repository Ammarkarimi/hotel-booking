import type { MetadataRoute } from "next";

// Lets Chrome and Edge install Innvela as an app: its own window and an icon on the desktop,
// taskbar and Start menu. It is still this website, so updates reach every hotel at once.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Innvela",
    short_name: "Innvela",
    description: "Hotel front desk: bookings, check-in, bills and rooms",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0b4f8a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Right-click the app's icon on the taskbar (or long-press on a phone) for these.
    shortcuts: [
      { name: "New booking", url: "/bookings/new" },
      { name: "Walk-in guest", url: "/bookings/new?walkin=1" },
      { name: "Calendar", url: "/calendar" },
      { name: "Day sheet", url: "/print/day-sheet" },
    ],
  };
}
