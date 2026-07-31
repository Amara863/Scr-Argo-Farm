export const recommendationMap = {
  milk: ["curd", "paneer", "butter", "ghee", "cheese"],
  paneer: ["milk", "curd", "butter", "cheese"],
  curd: ["milk", "paneer", "lassi"],
  ghee: ["milk", "butter", "curd"],
  butter: ["ghee", "milk", "paneer"],
} as const;

export type RecommendationKeyword = keyof typeof recommendationMap;
