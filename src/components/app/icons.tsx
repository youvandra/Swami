"use client";

// One icon family for the whole app (Phosphor). Regular weight for controls,
// duotone where an icon stands for a kind of result or task.
import {
  ArrowCounterClockwise,
  ArrowRight,
  ArrowUp,
  BeerStein,
  BookmarkSimple,
  CaretDown,
  ChartBar,
  ChatCircle,
  Coffee,
  Check,
  Copy,
  DotsThree,
  DownloadSimple,
  EnvelopeSimple,
  FileText,
  ForkKnife,
  Folder,
  GearSix,
  Info,
  Handshake,
  LinkSimple,
  List,
  ListNumbers,
  MagnifyingGlass,
  MapPin,
  MapTrifold,
  Paperclip,
  Path,
  PencilSimple,
  Plus,
  SidebarSimple,
  Sparkle,
  ArrowClockwise,
  Stop,
  Storefront,
  Trash,
  WarningCircle,
  UsersThree,
  VinylRecord,
  X,
  type IconWeight,
} from "@phosphor-icons/react";

type P = { className?: string; weight?: IconWeight };
type Ph = typeof Plus;

const make = (I: Ph, fallback: IconWeight = "regular", mirror = false) =>
  function Icon({ className, weight = fallback }: P) {
    return <I className={className} weight={weight} aria-hidden="true" style={mirror ? { transform: "scaleX(-1)" } : undefined} />;
  };

export const IconPlus = make(Plus, "bold");
export const IconSearch = make(MagnifyingGlass);
export const IconChat = make(ChatCircle);
export const IconFolder = make(Folder);
export const IconSidebar = make(SidebarSimple);
export const IconPanel = make(SidebarSimple, "regular", true);
export const IconClose = make(X);
export const IconClip = make(Paperclip);
export const IconArrowUp = make(ArrowUp, "bold");
export const IconArrowRight = make(ArrowRight);
export const IconCheck = make(Check, "bold");
export const IconDownload = make(DownloadSimple);
export const IconCopy = make(Copy);
export const IconBookmark = make(BookmarkSimple);
export const IconChevron = make(CaretDown, "bold");
export const IconList = make(ListNumbers);
export const IconMap = make(MapTrifold);
export const IconDoc = make(FileText);
export const IconMenu = make(List);
export const IconSettings = make(GearSix);
export const IconShare = make(LinkSimple);
export const IconSpark = make(Sparkle);
export const IconUsers = make(UsersThree);
export const IconRoute = make(Path);
export const IconPin = make(MapPin);
export const IconStore = make(Storefront);
export const IconTag = make(Handshake);
export const IconChart = make(ChartBar);
export const IconMail = make(EnvelopeSimple);
export const IconDots = make(DotsThree, "bold");
export const IconTrash = make(Trash);
export const IconInfo = make(Info);
export const IconBar = make(BeerStein);
export const IconFood = make(ForkKnife);
export const IconVinyl = make(VinylRecord);
export const IconCoffee = make(Coffee);
export const IconPencil = make(PencilSimple);
export const IconStop = make(Stop, "fill");
export const IconWarn = make(WarningCircle);
export const IconRetry = make(ArrowClockwise);
export const IconUndo = make(ArrowCounterClockwise);
