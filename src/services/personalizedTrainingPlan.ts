import { ActionPlanTask, TimeControl } from '../types/chess';

export type DailyPracticeBudget = '5–15 min' | '15–30 min' | '30+ min';
export type TrainingGoalStyle = 'milestone' | 'beyond';

export interface TrainingPlanPreferences {
  dailyPracticeBudget: DailyPracticeBudget;
  goalStyle: TrainingGoalStyle;
  timeControl: TimeControl;
}

function isDiagnosticTask(task: ActionPlanTask): boolean {
  return Boolean(task.sourceWeaknessId) || task.id === 'task-critical-position-review';
}

function timeControlInstruction(timeControl: TimeControl): string {
  switch (timeControl) {
    case 'rapid':
      return 'Rapid-specific practice: in post-game review, write at least two candidate moves and the opponent’s most forcing reply before revealing the engine line. In live play, use the time your position warrants.';
    case 'blitz':
      return 'Blitz-specific practice: train a compact checks–captures–threats scan for live games, then do the deeper calculation on the saved position after the game. Do not try to reproduce engine-depth calculation on the clock.';
    case 'bullet':
      return 'Bullet-specific practice: keep the live-game routine brief—checks, captures, threats, and immediate hanging pieces. Do the full candidate-line calculation after the game; engine-depth analysis is not a realistic live-play time target.';
  }
}

function goalInstruction(goalStyle: TrainingGoalStyle, isPrimary: boolean): string {
  if (goalStyle === 'milestone') {
    return isPrimary
      ? 'Milestone strategy: make this your main training target. Prioritize consistency on this finding and compare its rate per completed game in your next checkup before adding more drills.'
      : 'Milestone strategy: use this as supporting work after the main priority; avoid splitting every short session across unrelated weaknesses.';
  }

  return isPrimary
    ? 'Beyond-the-milestone strategy: establish a repeatable response to this highest-priority finding, then expand to the next distinct evidence-backed weakness. This plan does not guarantee a rating gain.'
    : 'Beyond-the-milestone strategy: build breadth only after you can explain this pattern reliably; use fresh games to verify transfer instead of assuming the weakness is fixed.';
}

/**
 * Re-orders and sizes existing engine-evidence-backed tasks around the user's
 * declared daily study budget, goal style, and selected time control.
 * It never creates diagnostic evidence or promotes a one-off position into a
 * recurring weakness; evidence fields and source-game links are preserved.
 */
export function buildPersonalizedTrainingPlan(
  sourceTasks: ActionPlanTask[],
  preferences: TrainingPlanPreferences
): ActionPlanTask[] {
  if (sourceTasks.length === 0) return [];

  const diagnosticTasks = sourceTasks.filter(isDiagnosticTask);
  const maintenanceTasks = sourceTasks.filter(task => !isDiagnosticTask(task));
  const primary = diagnosticTasks[0];
  const secondary = diagnosticTasks.slice(1);
  const preMove = maintenanceTasks.find(task => task.id === 'task-pre-move-check');
  const transfer = maintenanceTasks.find(task => task.id === 'task-transfer-check');
  const otherMaintenance = maintenanceTasks.filter(task => task !== preMove && task !== transfer);

  const sessionPriority: ActionPlanTask[] = [];
  if (primary) sessionPriority.push(primary);

  if (preferences.dailyPracticeBudget === '15–30 min') {
    if (preferences.goalStyle === 'milestone') {
      if (preMove) sessionPriority.push(preMove);
      else if (secondary[0]) sessionPriority.push(secondary[0]);
    } else {
      if (secondary[0]) sessionPriority.push(secondary[0]);
      else if (preMove) sessionPriority.push(preMove);
    }
  } else if (preferences.dailyPracticeBudget === '30+ min') {
    if (preferences.goalStyle === 'beyond') {
      sessionPriority.push(...secondary);
      if (preMove) sessionPriority.push(preMove);
      if (transfer) sessionPriority.push(transfer);
    } else {
      if (secondary[0]) sessionPriority.push(secondary[0]);
      if (preMove) sessionPriority.push(preMove);
      if (transfer) sessionPriority.push(transfer);
      sessionPriority.push(...secondary.slice(1));
    }
  }

  // Keep remaining valid tasks available for later sessions. De-duplicate by id
  // while preserving the personalized order of the first session.
  const ordered = [...sessionPriority, ...diagnosticTasks, ...maintenanceTasks, ...otherMaintenance];
  const seen = new Set<string>();
  const unique = ordered.filter(task => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });

  let diagnosticIndex = 0;
  return unique.map(task => {
    const diagnostic = isDiagnosticTask(task);
    const isPrimary = diagnostic && diagnosticIndex++ === 0;
    let duration = task.duration;
    let frequency = task.frequency;

    if (diagnostic) {
      duration = preferences.dailyPracticeBudget === '5–15 min'
        ? '8 min'
        : preferences.dailyPracticeBudget === '15–30 min'
        ? '10 min'
        : '12–15 min';
      frequency = preferences.dailyPracticeBudget === '5–15 min'
        ? '4–5 short sessions this week'
        : preferences.dailyPracticeBudget === '15–30 min'
        ? (isPrimary ? '3 focused sessions this week' : '2 sessions this week')
        : (isPrimary ? '4 focused sessions this week' : '2–3 sessions this week');
    } else if (task.id === 'task-pre-move-check') {
      duration = preferences.dailyPracticeBudget === '5–15 min' ? '2–3 min' : '5 min';
      frequency = 'Use in every selected rated game';
    } else if (task.id === 'task-transfer-check') {
      duration = preferences.dailyPracticeBudget === '5–15 min'
        ? '8–10 min'
        : preferences.dailyPracticeBudget === '15–30 min'
        ? '15 min'
        : '20 min';
      frequency = 'Once per week, then reassess with new games';
    }

    const description = diagnostic
      ? `${task.description} ${timeControlInstruction(preferences.timeControl)} ${goalInstruction(preferences.goalStyle, isPrimary)}`
      : task.description;

    return { ...task, duration, frequency, description };
  });
}
