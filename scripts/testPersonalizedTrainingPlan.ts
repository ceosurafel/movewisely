import { buildPersonalizedTrainingPlan } from '../src/services/personalizedTrainingPlan';
import { ActionPlanTask } from '../src/types/chess';

const tasks: ActionPlanTask[] = [
  {
    id: 'task-hanging-pieces',
    title: 'Hanging-piece errors: focused practice',
    duration: '12 min',
    frequency: '5 days this week',
    description: 'Replay your linked positions and identify the loose piece.',
    drillType: 'hanging_pieces',
    completed: false,
    priority: 'primary',
    sourceWeaknessId: 'weak-hanging-pieces',
    evidenceGameCount: 3,
    evidencePositionCount: 5,
    evidenceSummary: 'Engine evidence: 5 positions across 3 games.',
    evidenceGameUrls: ['https://www.chess.com/game/live/123'],
  },
  {
    id: 'task-opening-prep',
    title: 'Opening errors: focused practice',
    duration: '10 min',
    frequency: '3 days this week',
    description: 'Review the opening positions linked to this finding.',
    drillType: 'opening_prep',
    completed: false,
    priority: 'secondary',
    sourceWeaknessId: 'weak-opening-errors',
    evidenceGameCount: 2,
    evidencePositionCount: 3,
    evidenceSummary: 'Engine evidence: 3 positions across 2 games.',
    evidenceGameUrls: ['https://lichess.org/abcd1234'],
  },
  {
    id: 'task-tactics',
    title: 'Tactical errors: focused practice',
    duration: '15 min',
    frequency: '2 days this week',
    description: 'Calculate forcing replies from linked positions.',
    drillType: 'tactics',
    completed: false,
    priority: 'secondary',
    sourceWeaknessId: 'weak-tactics',
    evidenceGameCount: 2,
    evidencePositionCount: 4,
    evidenceSummary: 'Engine evidence: 4 positions across 2 games.',
    evidenceGameUrls: ['https://www.chess.com/game/live/456'],
  },
  {
    id: 'task-pre-move-check',
    title: 'Pre-move safety scan',
    duration: '5 min',
    frequency: 'Use in every rated game',
    description: 'Scan checks, captures, and threats before committing to a move.',
    drillType: 'hanging_pieces',
    completed: false,
    priority: 'maintenance',
    evidenceSummary: 'General prevention habit; not a diagnosed recurring weakness.',
    evidenceGameCount: 0,
    evidencePositionCount: 0,
  },
  {
    id: 'task-transfer-check',
    title: 'Transfer test: play, annotate, then compare',
    duration: '20 min',
    frequency: 'Once this week',
    description: 'Annotate critical decisions before using the engine.',
    drillType: 'tactics',
    completed: false,
    priority: 'maintenance',
    evidenceSummary: 'Progress measurement task.',
    evidenceGameCount: 0,
    evidencePositionCount: 0,
  },
];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

function ids(plan: ActionPlanTask[]): string[] {
  return plan.map(task => task.id);
}

const shortMilestone = buildPersonalizedTrainingPlan(tasks, {
  dailyPracticeBudget: '5–15 min',
  goalStyle: 'milestone',
  timeControl: 'rapid',
});
assert(shortMilestone[0].id === 'task-hanging-pieces', 'short plan starts with the highest-ranked evidenced weakness');
assert(shortMilestone[0].duration === '8 min', 'short plan compresses the main drill to fit a 5–15 minute budget');
assert(shortMilestone[0].description.includes('Rapid-specific practice'), 'rapid players receive rapid-specific review instructions');
assert(shortMilestone[0].description.includes('Milestone strategy'), 'milestone goal changes the coaching instruction');
assert(shortMilestone[0].evidenceGameCount === 3 && shortMilestone[0].evidencePositionCount === 5, 'personalization preserves evidence counts');
assert(shortMilestone[0].evidenceGameUrls?.[0] === tasks[0].evidenceGameUrls?.[0], 'personalization preserves actual source-game links');
assert(shortMilestone.slice(0, 1).length === 1, 'a short-budget first session shows only one priority task');

const mediumMilestone = buildPersonalizedTrainingPlan(tasks, {
  dailyPracticeBudget: '15–30 min',
  goalStyle: 'milestone',
  timeControl: 'blitz',
});
assert(ids(mediumMilestone).slice(0, 2).join(',') === 'task-hanging-pieces,task-pre-move-check', '15–30 minute milestone plan pairs the main weakness with a preventive habit');
assert(mediumMilestone[0].duration === '10 min' && mediumMilestone[1].duration === '5 min', 'medium plan allocates a workable first-session duration');
assert(mediumMilestone[0].description.includes('Blitz-specific practice'), 'blitz players receive compact live-play guidance and deeper post-game review');

const mediumBeyond = buildPersonalizedTrainingPlan(tasks, {
  dailyPracticeBudget: '15–30 min',
  goalStyle: 'beyond',
  timeControl: 'bullet',
});
assert(ids(mediumBeyond).slice(0, 2).join(',') === 'task-hanging-pieces,task-opening-prep', 'beyond-milestone plan broadens to a second distinct evidenced weakness');
assert(mediumBeyond[0].description.includes('Bullet-specific practice'), 'bullet plan avoids presenting engine-depth calculation as a live-play time target');
assert(mediumBeyond[0].description.includes('Beyond-the-milestone strategy'), 'beyond goal changes the coaching instruction');

const longBeyond = buildPersonalizedTrainingPlan(tasks, {
  dailyPracticeBudget: '30+ min',
  goalStyle: 'beyond',
  timeControl: 'rapid',
});
assert(ids(longBeyond).join(',') === 'task-hanging-pieces,task-opening-prep,task-tactics,task-pre-move-check,task-transfer-check', 'long beyond plan sequences all evidenced weaknesses before maintenance and transfer tasks');
assert(longBeyond.slice(0, 3).every(task => task.duration === '12–15 min'), 'long plan allocates longer diagnostic drills');

const empty = buildPersonalizedTrainingPlan([], {
  dailyPracticeBudget: '15–30 min',
  goalStyle: 'milestone',
  timeControl: 'rapid',
});
assert(empty.length === 0, 'empty or insufficient-data input does not invent training tasks');

console.log('\nPersonalized training plan tests passed.');
