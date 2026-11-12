export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://zebok.github.io/Sebastian_Porini"
).replace(/\/$/, "");

export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(
  /\/$/,
  ""
);

