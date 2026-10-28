// Line icons on a 16px grid, stroke follows currentColor.
type P = { className?: string };

const Svg = ({ className, children }: P & { children: React.ReactNode }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IconPlus = (p: P) => <Svg {...p}><path d="M8 3v10M3 8h10" /></Svg>;
export const IconSearch = (p: P) => <Svg {...p}><circle cx="7" cy="7" r="4.2" /><path d="m10.2 10.2 3.3 3.3" /></Svg>;
export const IconChat = (p: P) => <Svg {...p}><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v5A1.5 1.5 0 0 1 11.5 11H7l-3 2.5V11h0A1.5 1.5 0 0 1 3 9.5Z" /></Svg>;
export const IconFolder = (p: P) => <Svg {...p}><path d="M2.5 5A1.5 1.5 0 0 1 4 3.5h2.4l1.4 1.5H12A1.5 1.5 0 0 1 13.5 6.5v5A1.5 1.5 0 0 1 12 13H4a1.5 1.5 0 0 1-1.5-1.5Z" /></Svg>;
export const IconSidebar = (p: P) => <Svg {...p}><rect x="2.5" y="3" width="11" height="10" rx="2" /><path d="M6.5 3v10" /></Svg>;
export const IconPanel = (p: P) => <Svg {...p}><rect x="2.5" y="3" width="11" height="10" rx="2" /><path d="M9.5 3v10" /></Svg>;
export const IconClose = (p: P) => <Svg {...p}><path d="m4 4 8 8M12 4l-8 8" /></Svg>;
export const IconClip = (p: P) => <Svg {...p}><path d="M10.5 5 6 9.5a1.4 1.4 0 0 0 2 2l4.6-4.6a2.8 2.8 0 0 0-4-4L4 7.5a4.2 4.2 0 0 0 6 6l3-3" /></Svg>;
export const IconArrowUp = (p: P) => <Svg {...p}><path d="M8 13V3M3.8 7.2 8 3l4.2 4.2" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="m3.5 8.5 3 3 6-7" /></Svg>;
export const IconDownload = (p: P) => <Svg {...p}><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" /></Svg>;
export const IconCopy = (p: P) => <Svg {...p}><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" /></Svg>;
export const IconBookmark = (p: P) => <Svg {...p}><path d="M4.5 2.5h7v11L8 11l-3.5 2.5Z" /></Svg>;
export const IconChevron = (p: P) => <Svg {...p}><path d="m4.5 6 3.5 3.5L11.5 6" /></Svg>;
export const IconList = (p: P) => <Svg {...p}><path d="M6 4h7.5M6 8h7.5M6 12h7.5" /><circle cx="3" cy="4" r=".6" fill="currentColor" /><circle cx="3" cy="8" r=".6" fill="currentColor" /><circle cx="3" cy="12" r=".6" fill="currentColor" /></Svg>;
export const IconMap = (p: P) => <Svg {...p}><path d="M2.5 4.2 6 2.8l4 1.6 3.5-1.4v8.8L10 13.2l-4-1.6-3.5 1.4Z" /><path d="M6 2.8v8.8M10 4.4v8.8" /></Svg>;
export const IconDoc = (p: P) => <Svg {...p}><path d="M4 2.5h5.5L12.5 5.5v8H4Z" /><path d="M9.5 2.5v3h3M6 8.5h4.5M6 11h3" /></Svg>;
export const IconMenu = (p: P) => <Svg {...p}><path d="M2.5 5h11M2.5 11h7" /></Svg>;
export const IconSettings = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="2" /><path d="M8 1.8v1.6M8 12.6v1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M1.8 8h1.6M12.6 8h1.6M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" /></Svg>;
export const IconShare = (p: P) => <Svg {...p}><path d="M8 9.5V2.5M5 5.2 8 2.3l3 2.9M3.5 8v4.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8" /></Svg>;
export const IconSpark = (p: P) => <Svg {...p}><path d="M8 2.5 9.2 6.8 13.5 8 9.2 9.2 8 13.5 6.8 9.2 2.5 8 6.8 6.8Z" /></Svg>;
export const IconUsers = (p: P) => <Svg {...p}><circle cx="6" cy="5.5" r="2.2" /><path d="M2.5 13c.4-2 1.8-3.2 3.5-3.2S9.1 11 9.5 13" /><path d="M10.5 3.6a2.2 2.2 0 0 1 0 4M11.8 9.9c1 .5 1.6 1.6 1.8 3.1" /></Svg>;
export const IconRoute = (p: P) => <Svg {...p}><circle cx="4" cy="12" r="1.5" /><circle cx="12" cy="4" r="1.5" /><path d="M5.5 12h4a2 2 0 0 0 0-4h-3a2 2 0 0 1 0-4h4" /></Svg>;
export const IconPin = (p: P) => <Svg {...p}><path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14Z" /><circle cx="8" cy="6.5" r="1.6" /></Svg>;
export const IconStore = (p: P) => <Svg {...p}><path d="M2.5 6.5 3.5 3h9l1 3.5M2.5 6.5h11M2.5 6.5a1.8 1.8 0 0 0 3.7 0 1.8 1.8 0 0 0 3.6 0 1.8 1.8 0 0 0 3.7 0M3.5 8.5v4.5h9V8.5M6.5 13v-2.5h3V13" /></Svg>;
export const IconTag = (p: P) => <Svg {...p}><path d="M2.5 8.2V3.5a1 1 0 0 1 1-1h4.7l5.3 5.3a1 1 0 0 1 0 1.4l-4.3 4.3a1 1 0 0 1-1.4 0Z" /><circle cx="5.5" cy="5.5" r="1" /></Svg>;
export const IconChart = (p: P) => <Svg {...p}><path d="M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5" /></Svg>;
export const IconMail = (p: P) => <Svg {...p}><rect x="2.5" y="3.5" width="11" height="9" rx="1.5" /><path d="m3 4.5 5 4 5-4" /></Svg>;
