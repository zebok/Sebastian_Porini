import { BASE_PATH } from "./site";

export function getCvDownloadInfo(cvPath?: string, lang = "en") {
  const normalizedPath = cvPath || "/SebastianPorini_English.pdf";
  const cleanCvPath = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;

  return {
    url: `${BASE_PATH}${cleanCvPath}`,
    filename:
      lang === "es" ? "Sebastian_Porini_CV_ES.pdf" : "Sebastian_Porini_CV_EN.pdf",
  };
}

