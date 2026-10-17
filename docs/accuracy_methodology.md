# MoveWisely Accuracy Methodology V1.1 (Experimental; Uncalibrated)

## Status

This is a deterministic internal scoring convention. It is **not empirically calibrated**, is not a validated win-probability model, and has not been proven equivalent to Chess.com or Lichess analysis. Its values should be labelled as MoveWisely scores, not a universal chess accuracy standard.

## Inputs and eligibility

Every non-terminal searched position must have a successfully completed Stockfish analysis with a finite score and legal principal variation. A terminal checkmate or draw is resolved from exact chess rules and tagged with terminal-state provenance rather than sending a search request with no legal move. Missing or malformed engine evaluations are errors, not neutral evaluations. Partial, failed, and cancelled games must not be included in completed-game aggregates.

## Evaluation perspective

Stockfish UCI scores are parsed relative to the side to move. MoveWisely normalizes the score to the player's perspective before comparing positions. Mate scores are preserved as mate scores in the engine layer and mapped to a large signed centipawn-equivalent only for downstream comparisons that require a scalar. Mate-distance mappings are heuristic, not equivalent to centipawn values.

## Score proxy

The current implementation uses this logistic proxy:

\[
P(cp)=\frac{1}{1+10^{-cp/400}}
\]

The proxy is bounded to 0 for evaluations at or below -4000 cp and 1 for evaluations at or above +4000 cp. It does **not** separately model draws, so it must not be represented as a validated win probability or expected score. The `calculateExpectedPoints` name is retained for code compatibility; interpret the value as an experimental score proxy.

## Move loss and accuracy

For a played move that is not the selected top engine move:

\[
\Delta cp=\max(0, cp_{before}-cp_{after})
\]

\[
\Delta P=\max(0, P_{before}-P_{after})
\]

\[
Acc_i=100\,e^{-5.5\Delta P}
\]

A move matching the top candidate at the configured engine search budget is assigned zero move loss for the current report. Its post-move evaluation is still stored as a separately searched value. This is a practical engine-reference convention, not a proof that the move is objectively optimal at infinite depth.

## Standard grades

Each input metric produces a severity tier, and the more severe tier is used. This avoids a large centipawn loss being downgraded just because the score-proxy loss happens to be small.

| Tier | Centipawn loss | Score-proxy loss |
|---|---:|---:|
| Best | <= 5 | <= 0.015 |
| Excellent | <= 25 | <= 0.035 |
| Good | <= 65 | <= 0.080 |
| Inaccuracy | <= 140 | <= 0.160 |
| Mistake | <= 280 | <= 0.300 |
| Blunder | > 280 | > 0.300 |

The table applies as a maximum severity tier for each signal; the final grade is the worse (more severe) result from the two signals. Values must be finite. Negative losses are clamped to zero by the grading function; non-finite values are rejected.

## Contextual labels

- **Book**: only when the opening-book helper recognizes the played move inside the supported move range.
- **Brilliant**: requires a near-best move, a non-pawn piece actually legally capturable on its destination, and the existing advantage-preservation checks. This remains a heuristic and should be treated conservatively.
- **Great**: requires a positive root score for PV1 and a signed, same-root PV1/PV2 score separation of at least 150 cp-equivalent, in addition to the best/near-best move condition.
- **Miss**: requires a verified positive pre-move advantage and a material deterioration under current thresholds.

Contextual labels are heuristic annotations, not standardized ratings or proof that no other good move exists.

## Interactive analyzer interpretation

The game analyzer displays the engine grade, best-move candidate, principal variation, before/after evaluation, and move-level accuracy for moves that were actually searched. In a checkup report, deep move-by-move analysis is performed for the selected player's moves; opponent moves remain visible in the timeline but are not assigned fabricated grades. A user-imported PGN can be analyzed from either White's or Black's perspective.

The evaluation chart is intentionally labelled **evaluation before the analyzed player's moves**. It is not a full-ply graph: opponent replies between those positions are not separately searched by the batch checkup. Values are normalized to the analyzed player's perspective and displayed as centipawn-equivalent values. The logistic score proxy is separate from centipawn evaluation and remains experimental, uncalibrated, and not equivalent to a platform accuracy score.

Annotated PGN export attaches a MoveWisely comment only to moves that have recorded engine evidence. Export comments include the move grade, before/after evaluation, top engine candidate, experimental move-accuracy value, and search depth. Opponent moves and unsearched positions are not assigned grades.

## Aggregation

Only successfully completed games are eligible for cross-game diagnostics. The service stores an overall arithmetic mean and a separate non-book move mean. Interpret both as MoveWisely internal metrics. Empty input returns zero counts and zero placeholders, which must be interpreted together with the analysis status; it does not mean that a player scored 0%.

## Evidence thresholds for player diagnostics

- Recurring phase-loss concentration requires at least **3 completed losses**, at least **2 losses attributed to the phase bucket**, at least 40% concentration, and linked engine-reviewed error positions from at least **2 distinct loss games**. Phase counts sum to the completed-loss denominator.
- A recurring opening leak requires at least **3 completed games for the opening**, a score of 40% or below, and engine-reviewed opening-error positions in at least **2 distinct games**. A poor result or one isolated error is not proof of a recurring opening-theory cause.
- Each emitted recurring weakness records its eligible sample denominator, distinct supporting-game count, evidence-position count, supporting-game rate, minimum recurrence threshold, and a human-readable evidence rule. Every support count is derived from the linked evidence list rather than the three-position preview.
- Opening-exit evaluation includes the number of games with a reviewed exit-window position. If no position was reviewed, the value is **unavailable (null)**, not 0 cp.
- Phase names currently use a move-number heuristic: moves 1–12 are Opening, 13–29 Middlegame, and move 30 onward is labelled Endgame for compatibility. This is not a board-material phase classifier. Move-28+ advantage slips are described as late-game signals, not proof of a formal endgame state.
- Tactical recurrence uses full evidence, not only the three-item display preview. Repeated findings require evidence across separate games; one move can have multiple motifs. A large evaluation drop by itself is not a verified fork, pin, hanging piece, or missed mate.
- Move number is not clock telemetry. Errors after move 35 may be called late-game errors, but the report must not infer time pressure or fatigue without clock data.
- Small samples are descriptive and do not establish causality or predict rating change.

## Versioning and calibration

Current code version: `MoveWisely Accuracy V1.1 (Experimental Score Proxy; Uncalibrated)`.

Changes to evaluation mapping, grade thresholds, mate handling, or aggregation require a new methodology version and regression fixtures. Before calling any version calibrated, create a representative labeled dataset, select a defensible reference outcome metric, tune parameters only on training data, report held-out validation results, and measure calibration error. Do not claim parity with any commercial platform without independent evidence.

## Engine-line roots and tactical evidence

Each analyzed move preserves two separate engine lines: the best-move principal variation from the position **before** the played move, and the opponent's continuation line from the position **after** it. Best-move selection uses the former; refutation explanations and move-triggered tactical checks use the latter. These lines must not be interchanged because their first move is legal only from its own root position.

A large centipawn/score-proxy drop is evidence of an evaluation loss, not by itself evidence of a fork, pin, hanging piece, or forced mate. Specific tactical labels require supporting board geometry and/or a legal after-move engine continuation. When no specific motif is substantiated, the evidence remains an evaluation drop rather than being labelled a tactical mistake.


## Personalized training plan and rating timeline

Training tasks are ranked from recurring weaknesses that meet the report's evidence rules. Each such task records its distinct supporting-game count, reviewed-position count, and qualification rule; the report provides a few source-game links so the user can return to the underlying games. When no weakness passes a recurrence threshold, the plan labels the best reviewed positions as provisional review prompts rather than claiming a recurring weakness.

The four-week cycle is a structured practice-and-reassessment block, not a promise that a rating target will be reached in four weeks. A milestone ETA is shown only if the completed games contain at least 10 actual player-rating observations across 8 distinct dates spanning at least 28 days. The estimate is a broad extrapolation from early-to-recent game-rating samples; it does not model training adherence, opponents, matchmaking volatility, study quality, or the player's wider development. When the sample is too short or the observed trend is flat/downward, the correct result is “not estimable”, not an invented deadline. Re-run the checkup after additional rated games and evaluate whether the specific evidence-backed error rates changed.
