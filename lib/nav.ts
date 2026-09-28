import {
  Cpu,
  Clapperboard,
  Image as ImageIcon,
  Library,
  FolderKanban,
  BookText,
  Gauge,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "superComputer"
  | "video"
  | "image"
  | "library"
  | "projects"
  | "prompts"
  | "usage"
  | "settings";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  group: "create" | "manage";
  /** Keyboard shortcut digit (⌘/Ctrl + digit). */
  shortcut?: string;
}

/** Single source of truth for sidebar, mobile nav and the command palette. */
export const NAV_ITEMS: NavItem[] = [
  { key: "superComputer", href: "/super-computer", icon: Cpu, group: "create", shortcut: "1" },
  { key: "video", href: "/video", icon: Clapperboard, group: "create", shortcut: "2" },
  { key: "image", href: "/image", icon: ImageIcon, group: "create", shortcut: "3" },
  { key: "library", href: "/library", icon: Library, group: "manage" },
  { key: "projects", href: "/projects", icon: FolderKanban, group: "manage" },
  { key: "prompts", href: "/prompts", icon: BookText, group: "manage" },
  { key: "usage", href: "/usage", icon: Gauge, group: "manage" },
  { key: "settings", href: "/settings", icon: Settings, group: "manage" },
];
