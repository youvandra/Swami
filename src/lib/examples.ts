// The acts the app's examples name. On live data they are real: a famous act for the questions that suit any size
// (routing, stadium venues, sponsors), a mid-size one where the opener ranking shows what it does. The fixture's
// acts are made up, so its examples stay on them.

export const FIXTURE_ACT = "Marlow Vane";

export type Examples = { famous: string; mid: string; city: string; abroad: string };

export const examplesFor = (live: boolean): Examples =>
  live ? { famous: "Taylor Swift", mid: "Big Thief", city: "Chicago", abroad: "Jakarta" } : { famous: FIXTURE_ACT, mid: FIXTURE_ACT, city: "Chicago", abroad: "Chicago" };

/** The workspace's own artists; the fixture's default act is nobody's on live data. */
export const ownArtists = (artists: string[], live: boolean) => (live ? artists.filter((a) => a !== FIXTURE_ACT) : artists);
