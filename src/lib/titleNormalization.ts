import { recommendationMap, type RecommendationKeyword } from "@/data/recommendationMap";

export const normalizeProductTitle = (title: string): string =>
  title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasKeyword = (normalizedTitle: string, keyword: string): boolean =>
  normalizedTitle.split(" ").includes(keyword);

export const getRecommendationKeyword = (
  title: string,
): RecommendationKeyword | null => {
  const normalizedTitle = normalizeProductTitle(title);

  return (
    (Object.keys(recommendationMap) as RecommendationKeyword[]).find((keyword) =>
      hasKeyword(normalizedTitle, keyword),
    ) ?? null
  );
};

export const titleMatchesKeyword = (title: string, keyword: string): boolean =>
  hasKeyword(normalizeProductTitle(title), keyword);
