// Splash Sports contest to pull standings from. Stable for the season.
export const CONTEST_ID = "contest_01KYYWHDNNMHVV2VP3XZM8CMER";

// Link back to the real contest on Splash Sports
export const SPLASH_STANDINGS_URL = `https://contests.app.splashsports.com/team-pickem/contests/${CONTEST_ID}/standings`;

// Only these user handles (Splash Sports "user.handle" field) are shown on the
// site, out of the full contest leaderboard. Case-sensitive match against the
// handle Splash Sports returns.
export const FILTERED_HANDLES: string[] = [
  "Rattly",
  "THE_LEDGE",
  "lucky_dog",
  "EMILYK24",
  "NMEPitt",
  "Ken-grapes",
];
