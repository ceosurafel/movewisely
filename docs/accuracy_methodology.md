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

- Recurring phase-loss concentration requires at least **3 completed losses**; phase counts sum to the loss denominator, and attached positions come from games attributed to that phase.
- A recurring opening leak requires at least **3 completed games**, a score of 40% or below, and linked engine-reviewed opening-error evidence. A poor result alone is an outcome snapshot, not proof of an opening-theory cause.
- Opening-exit evaluation includes the number of games with a reviewed exit-window position. If no position was reviewed, the value is **unavailable (null)**, not 0 cp.
- Tactical recurrence uses full evidence, not only the three-item display preview. Repeated findings require evidence across separate games; one move can have multiple motifs.
- Move number is not clock telemetry. Errors after move 35 may be called late-game errors, but the report must not infer time pressure or fatigue without clock data. An endgame conversion claim requires an engine-reviewed mistake/blunder; the result alone is not proof.
- Small samples are descriptive and do not establish causality or predict rating change.

## Versioning and calibration

Current code version: `MoveWisely Accuracy V1.1 (Experimental Score Proxy; Uncalibrated)`.

Changes to evaluation mapping, grade thresholds, mate handling, or aggregation require a new methodology version and regression fixtures. Before calling any version calibrated, create a representative labeled dataset, select a defensible reference outcome metric, tune parameters only on training data, report held-out validation results, and measure calibration error. Do not claim parity with any commercial platform without independent evidence.
