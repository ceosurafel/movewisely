import { GameRecord, RatingTimelineEstimate } from '../types/chess';

interface DatedRating {
  date: string;
  rating: number;
}

function median(values: number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

/**
 * Estimates a broad milestone horizon only from actual per-game player ratings.
 *
 * This deliberately ignores GameRecord.userRating because the ingestion layer may
 * fall back to a current profile rating when historical game ratings are missing.
 * A trend is shown only with >=10 rated games on >=8 dates over >=28 days. Even
 * then, this is a rough extrapolation—not an individualized guarantee of progress.
 */
export function estimateRatingTimeline(
  games: GameRecord[],
  currentRating: number,
  targetMilestone: number
): RatingTimelineEstimate {
  const observations: DatedRating[] = [];

  for (const game of games) {
    const rawRating = game.userColor === 'white' ? game.white?.rating : game.black?.rating;
    const date = typeof game.date === 'string' ? game.date.slice(0, 10) : '';
    const rating = typeof rawRating === 'number' && Number.isFinite(rawRating) ? rawRating : NaN;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T00:00:00Z'))) continue;
    if (rating < 100 || rating > 3500) continue;
    observations.push({ date, rating });
  }

  const dates = new Map<string, number[]>();
  for (const observation of observations) {
    const bucket = dates.get(observation.date) ?? [];
    bucket.push(observation.rating);
    dates.set(observation.date, bucket);
  }
  const dailyRatings = Array.from(dates.entries())
    .map(([date, ratings]) => ({ date, rating: median(ratings) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const observedDays = dailyRatings.length >= 2
    ? Math.max(0, Math.round((Date.parse(dailyRatings[dailyRatings.length - 1].date + 'T00:00:00Z') - Date.parse(dailyRatings[0].date + 'T00:00:00Z')) / 86400000))
    : 0;

  const base = {
    estimatedWeeks: null as number | null,
    estimateRangeWeeks: null as { min: number; max: number } | null,
    sampleGamesCount: observations.length,
    distinctDatesCount: dailyRatings.length,
    observedDays,
    historicalRatingChange: null as number | null,
    weeklyRatingChange: null as number | null,
  };

  if (Number.isFinite(currentRating) && Number.isFinite(targetMilestone) && targetMilestone <= currentRating) {
    return {
      ...base,
      status: 'goal-reached',
      explanation: 'Your current verified rating has reached or exceeded the selected milestone. This report does not forecast progress beyond it.',
    };
  }

  if (observations.length < 10 || dailyRatings.length < 8 || observedDays < 28) {
    return {
      ...base,
      status: 'insufficient-history',
      explanation: `A rating ETA is not available yet: the trend check requires at least 10 games with actual per-game ratings across 8 dates and 28 days. This sample has ${observations.length} rated games, ${dailyRatings.length} distinct dates, and ${observedDays} observed days. The 4-week training cycle is a review period, not a promised time to reach the rating goal.`,
    };
  }

  const groupSize = Math.max(3, Math.floor(dailyRatings.length * 0.25));
  const early = dailyRatings.slice(0, groupSize);
  const late = dailyRatings.slice(-groupSize);
  const earlyDate = Date.parse(early[Math.floor(early.length / 2)].date + 'T00:00:00Z');
  const lateDate = Date.parse(late[Math.floor(late.length / 2)].date + 'T00:00:00Z');
  const elapsedWeeks = (lateDate - earlyDate) / (7 * 86400000);
  const ratingChange = mean(late.map(x => x.rating)) - mean(early.map(x => x.rating));
  const weeklyChange = elapsedWeeks > 0 ? ratingChange / elapsedWeeks : 0;

  if (!Number.isFinite(weeklyChange) || weeklyChange <= 1) {
    return {
      ...base,
      status: 'no-positive-trend',
      historicalRatingChange: Math.round(ratingChange),
      weeklyRatingChange: Number.isFinite(weeklyChange) ? Math.round(weeklyChange * 10) / 10 : null,
      explanation: `The dated sample does not show a sufficiently positive sustained rating trend to estimate arrival time (early-to-recent change: ${Math.round(ratingChange)} points). Keep the training cycle, then reassess with a fresh set of games; a flat or negative sample must not be turned into a made-up ETA.`,
    };
  }

  const distance = Math.max(0, targetMilestone - currentRating);
  const estimate = Math.max(1, Math.round(distance / weeklyChange));
  const min = Math.max(1, Math.ceil(distance / (weeklyChange * 1.5)));
  const max = Math.max(min, Math.ceil(distance / (weeklyChange * 0.5)));
  const historicalChange = Math.round(ratingChange);
  const roundedWeeklyChange = Math.round(weeklyChange * 10) / 10;

  return {
    ...base,
    status: 'estimate-available',
    estimatedWeeks: estimate,
    estimateRangeWeeks: { min, max },
    historicalRatingChange: historicalChange,
    weeklyRatingChange: roundedWeeklyChange,
    explanation: `A very rough pace range of ${min}–${max} weeks is extrapolated from ${observations.length} rated games over ${observedDays} days (about ${roundedWeeklyChange} rating points/week across the early-to-recent samples). This is not a prediction: rating volatility, opponents, time control, training adherence, and other factors are not modeled.`,
  };
}
