export interface RatingBenchmark {
  ratingTier: number;
  label: string;
  expectedAccuracy: number;
  expectedBlundersPerGame: number;
  expectedHangingPiecesPerGame: number;
  openingDisciplineScore: number;
  endgameConversionScore: number;
}

export const RATING_BENCHMARKS: RatingBenchmark[] = [
  {
    ratingTier: 600,
    label: '600–799 (Beginner)',
    expectedAccuracy: 56.5,
    expectedBlundersPerGame: 3.8,
    expectedHangingPiecesPerGame: 2.9,
    openingDisciplineScore: 45,
    endgameConversionScore: 38,
  },
  {
    ratingTier: 800,
    label: '800–999 (Novice)',
    expectedAccuracy: 62.0,
    expectedBlundersPerGame: 2.9,
    expectedHangingPiecesPerGame: 2.1,
    openingDisciplineScore: 54,
    endgameConversionScore: 47,
  },
  {
    ratingTier: 1000,
    label: '1000–1199 (Developing)',
    expectedAccuracy: 67.5,
    expectedBlundersPerGame: 2.2,
    expectedHangingPiecesPerGame: 1.5,
    openingDisciplineScore: 63,
    endgameConversionScore: 56,
  },
  {
    ratingTier: 1200,
    label: '1200–1399 (Intermediate)',
    expectedAccuracy: 72.8,
    expectedBlundersPerGame: 1.6,
    expectedHangingPiecesPerGame: 1.0,
    openingDisciplineScore: 71,
    endgameConversionScore: 65,
  },
  {
    ratingTier: 1400,
    label: '1400–1599 (Club Aspirant)',
    expectedAccuracy: 76.5,
    expectedBlundersPerGame: 1.1,
    expectedHangingPiecesPerGame: 0.6,
    openingDisciplineScore: 78,
    endgameConversionScore: 73,
  },
  {
    ratingTier: 1600,
    label: '1600–1799 (Club Player)',
    expectedAccuracy: 80.2,
    expectedBlundersPerGame: 0.8,
    expectedHangingPiecesPerGame: 0.35,
    openingDisciplineScore: 84,
    endgameConversionScore: 79,
  },
  {
    ratingTier: 1800,
    label: '1800–1999 (Advanced)',
    expectedAccuracy: 83.5,
    expectedBlundersPerGame: 0.55,
    expectedHangingPiecesPerGame: 0.18,
    openingDisciplineScore: 89,
    endgameConversionScore: 85,
  },
  {
    ratingTier: 2000,
    label: '2000–2199 (Expert)',
    expectedAccuracy: 86.4,
    expectedBlundersPerGame: 0.38,
    expectedHangingPiecesPerGame: 0.08,
    openingDisciplineScore: 93,
    endgameConversionScore: 90,
  },
  {
    ratingTier: 2200,
    label: '2200+ (Master Class)',
    expectedAccuracy: 89.2,
    expectedBlundersPerGame: 0.22,
    expectedHangingPiecesPerGame: 0.04,
    openingDisciplineScore: 96,
    endgameConversionScore: 94,
  },
];

export function getNextMilestone(currentRating: number): number {
  if (currentRating < 600) return 600;
  // Calculate the next 100-point ceiling
  const nextHundred = Math.ceil((currentRating + 1) / 100) * 100;
  return nextHundred;
}

export function getBenchmarkForRating(rating: number): RatingBenchmark {
  const sorted = [...RATING_BENCHMARKS].sort((a, b) => b.ratingTier - a.ratingTier);
  for (const b of sorted) {
    if (rating >= b.ratingTier) return b;
  }
  return RATING_BENCHMARKS[0];
}
