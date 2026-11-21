// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Metric formulas and the decision rule. Pure functions over result sets; report.mjs prints their output.
// A section that a result set does not contain is "not recorded" (null). A clause with a not-recorded input FAILS.

export function clauseTitles(rules) {
    const d = rules.decision;
    return [
        ['C1', 'Stability: v2 is not worse than v1'],
        ['C2', 'Control sensitivity: v2 is not worse than v1'],
        [
            'C3',
            `Held-out features: v2 handles at least ${d.min_features_handled} of ${Object.keys(rules.features).length}, no fewer than v1, and rejects F4`,
        ],
        ['C4', 'Route leakage: v2 has no more violations than v1'],
        ['C5', `Cost: every component is at most ${d.cost_ratio_max}x v1, or each excess is tied to a measured gain`],
    ].map(([id, title]) => ({id, title}));
}

export function fraction(num, den) {
    return {num, den};
}

// den 0 counts as rate 0: a version that produced nothing to measure cannot show the property.
function atLeast(a, b) {
    const [an, ad] = a.den === 0 ? [0, 1] : [a.num, a.den];
    const [bn, bd] = b.den === 0 ? [0, 1] : [b.num, b.den];
    return an * bd >= bn * ad;
}

function greater(a, b) {
    return !atLeast(b, a);
}

export function showFraction(f) {
    if (f === null) {
        return 'not recorded';
    }
    const rate = f.den === 0 ? '0.000' : (f.num / f.den).toFixed(3);
    return `${f.num}/${f.den} (${rate})`;
}

export function featureHandled(record, spec) {
    if (!record) {
        return {handled: false, why: 'no record'};
    }
    if (!spec.expected_outcomes.includes(record.outcome)) {
        return {handled: false, why: `outcome ${record.outcome} not expected`};
    }
    if (record.outcome === 'emitted_passing') {
        return record.reviewer_equivalence === 'equivalent'
            ? {handled: false, why: 'emitted spec judged equivalent to existing coverage'}
            : {handled: true, why: 'spec emitted, all gates passed'};
    }
    if (record.outcome === 'rejected_duplicate') {
        return record.reviewer_equivalence === 'non_equivalent'
            ? {handled: false, why: 'rejection judged wrong by the blind reviewer'}
            : {handled: true, why: 'rejected as duplicate with evidence'};
    }
    if (record.outcome === 'rejected_unreachable') {
        const allowed = spec.allowed_unreachable_reasons ?? [];
        return allowed.includes(record.unreachable_reason)
            ? {handled: true, why: `rejected as unreachable (${record.unreachable_reason}) with evidence`}
            : {handled: false, why: `unreachable reason ${record.unreachable_reason} not allowed`};
    }
    return {handled: false, why: `outcome ${record.outcome}`};
}

function costOf(result) {
    const cost = result.cost;
    if (!cost) {
        return null;
    }
    const pipeline = cost.stages.filter((s) => s.category === 'pipeline');
    const manual = cost.manual ?? [];
    const sum = (kind) => manual.filter((m) => m.kind === kind).reduce((n, m) => n + m.value, 0);
    const has = (kind) => manual.some((m) => m.kind === kind);
    const hasStages = pipeline.length > 0;
    return {
        elapsed_seconds: hasStages ? pipeline.reduce((n, s) => n + s.elapsed_seconds, 0) : null,
        agent_calls: hasStages ? pipeline.reduce((n, s) => n + s.agent_calls, 0) + sum('agent_rounds') : null,
        fix_rounds: has('fix_rounds') ? sum('fix_rounds') : null,
        human_review_minutes: has('human_review_minutes') ? sum('human_review_minutes') : null,
        justifications: cost.justifications ?? [],
    };
}

export function summarize(result, rules) {
    const featureRecords = result.features ?? null;
    const features = featureRecords
        ? Object.fromEntries(
              Object.keys(rules.features)
                  .sort()
                  .map((id) => [
                      id,
                      featureHandled(
                          featureRecords.find((f) => f.feature_id === id),
                          rules.features[id],
                      ),
                  ]),
          )
        : null;
    const specs = result.stability?.specs;
    const controls = result.control_sensitivity?.controls;
    const runs = result.discovery?.runs;
    const count = (list, pred) => list.filter(pred).length;
    return {
        features,
        featuresHandled: features ? count(Object.values(features), (f) => f.handled) : null,
        stability: specs
            ? fraction(
                  count(specs, (s) => s.passed === rules.replays_per_spec),
                  specs.length,
              )
            : null,
        stabilityPooled: specs
            ? fraction(
                  specs.reduce((n, s) => n + s.passed, 0),
                  specs.length * rules.replays_per_spec,
              )
            : null,
        controls: controls
            ? {
                  pass: count(controls, (c) => c.result === 'pass'),
                  fail: count(controls, (c) => c.result === 'fail'),
                  blocked: count(controls, (c) => c.result === 'blocked'),
                  rate: fraction(
                      count(controls, (c) => c.result === 'pass'),
                      controls.length,
                  ),
              }
            : null,
        leakage: result.route_leakage ? result.route_leakage.violations : null,
        namedControls: result.route_leakage ? result.route_leakage.named_controls : null,
        discovery: runs
            ? {
                  overall: fraction(
                      count(runs, (r) => r.success),
                      runs.length,
                  ),
                  byVariant: Object.fromEntries(
                      ['original', 'paraphrased', 'shuffled'].map((v) => {
                          const subset = runs.filter((r) => r.variant === v);
                          return [
                              v,
                              fraction(
                                  count(subset, (r) => r.success),
                                  subset.length,
                              ),
                          ];
                      }),
                  ),
              }
            : null,
        duplicateRejection: result.duplicate_rejection
            ? {
                  planted: fraction(
                      result.duplicate_rejection.planted_rejected,
                      result.duplicate_rejection.planted_total,
                  ),
                  nonEquivalent: fraction(
                      result.duplicate_rejection.proposals_non_equivalent,
                      result.duplicate_rejection.proposals_reviewed,
                  ),
              }
            : null,
        recall: result.known_bug_recall
            ? fraction(result.known_bug_recall.flagged, result.known_bug_recall.reproducing_total)
            : null,
        falsePositives: result.false_positives
            ? {
                  confirmed: result.false_positives.confirmed_findings,
                  false_positive: count(result.false_positives.adjudications, (a) => a.judgment === 'false_positive'),
                  unadjudicated:
                      result.false_positives.confirmed_findings - result.false_positives.adjudications.length,
                  states: result.false_positives.states_explored,
                  per100:
                      result.false_positives.states_explored === 0
                          ? 0
                          : (100 *
                                count(result.false_positives.adjudications, (a) => a.judgment === 'false_positive')) /
                            result.false_positives.states_explored,
              }
            : null,
        cost: costOf(result),
    };
}

function missing(...pairs) {
    return pairs.filter(([, value]) => value === null || value === undefined).map(([name]) => name);
}

function gainHolds(metric, a, b) {
    switch (metric) {
        case 'features_handled':
            return a.featuresHandled !== null && b.featuresHandled !== null && b.featuresHandled > a.featuresHandled;
        case 'stability_rate':
            return a.stability !== null && b.stability !== null && greater(b.stability, a.stability);
        case 'control_sensitivity_rate':
            return a.controls !== null && b.controls !== null && greater(b.controls.rate, a.controls.rate);
        case 'discovery_rate':
            return a.discovery !== null && b.discovery !== null && greater(b.discovery.overall, a.discovery.overall);
        default:
            return false;
    }
}

function clauseStability(a, b) {
    const gaps = missing(['A.stability', a.stability], ['B.stability', b.stability]);
    if (gaps.length) {
        return {pass: false, detail: `not recorded: ${gaps.join(', ')}`};
    }
    return {
        pass: atLeast(b.stability, a.stability),
        detail: `A=${showFraction(a.stability)} B=${showFraction(b.stability)}`,
    };
}

function clauseControls(a, b) {
    const gaps = missing(['A.control_sensitivity', a.controls], ['B.control_sensitivity', b.controls]);
    if (gaps.length) {
        return {pass: false, detail: `not recorded: ${gaps.join(', ')}`};
    }
    const show = (c) => `${showFraction(c.rate)} blocked=${c.blocked} failed=${c.fail}`;
    return {pass: atLeast(b.controls.rate, a.controls.rate), detail: `A=${show(a.controls)} B=${show(b.controls)}`};
}

function clauseFeatures(a, b, rules) {
    const gaps = missing(['A.features', a.features], ['B.features', b.features]);
    if (gaps.length) {
        return {pass: false, detail: `not recorded: ${gaps.join(', ')}`};
    }
    const min = rules.decision.min_features_handled;
    const f4 = b.features.F4;
    const parts = [
        [`B handled ${b.featuresHandled} >= ${min}`, b.featuresHandled >= min],
        [`B handled ${b.featuresHandled} >= A handled ${a.featuresHandled}`, b.featuresHandled >= a.featuresHandled],
        [`B rejects F4 (${f4.why})`, f4.handled],
    ];
    return {
        pass: parts.every(([, ok]) => ok),
        detail: parts.map(([text, ok]) => `${ok ? 'ok' : 'NO'}: ${text}`).join('; '),
    };
}

function clauseLeakage(a, b) {
    const gaps = missing(['A.route_leakage', a.leakage], ['B.route_leakage', b.leakage]);
    if (gaps.length) {
        return {pass: false, detail: `not recorded: ${gaps.join(', ')}`};
    }
    return {pass: b.leakage <= a.leakage, detail: `A=${a.leakage} B=${b.leakage}`};
}

function clauseCost(a, b, rules) {
    const d = rules.decision;
    if (!a.cost || !b.cost) {
        return {pass: false, detail: 'not recorded: cost section'};
    }
    const gaps = d.cost_components.flatMap((k) => missing([`A.${k}`, a.cost[k]], [`B.${k}`, b.cost[k]]));
    if (gaps.length) {
        return {pass: false, detail: `not recorded: ${gaps.join(', ')}`};
    }
    const lines = [];
    let pass = true;
    for (const k of d.cost_components) {
        const limit = d.cost_ratio_max * a.cost[k];
        if (b.cost[k] <= limit) {
            lines.push(`${k}: A=${a.cost[k]} B=${b.cost[k]} within limit ${limit}`);
            continue;
        }
        const tied = b.cost.justifications.filter(
            (j) => j.component === k && d.gain_metrics.includes(j.gain_metric) && gainHolds(j.gain_metric, a, b),
        );
        pass &&= tied.length > 0;
        lines.push(
            tied.length
                ? `${k}: A=${a.cost[k]} B=${b.cost[k]} over limit ${limit}, tied to gain in ${tied.map((j) => j.gain_metric).join('+')}`
                : `${k}: A=${a.cost[k]} B=${b.cost[k]} over limit ${limit}, no measured gain tied`,
        );
    }
    return {pass, detail: lines.join('; '), lines};
}

export function decide(a, b, rules) {
    const titles = clauseTitles(rules);
    const results = [
        clauseStability(a, b),
        clauseControls(a, b),
        clauseFeatures(a, b, rules),
        clauseLeakage(a, b),
        clauseCost(a, b, rules),
    ];
    const clauses = titles.map((t, i) => ({...t, ...results[i]}));
    return {clauses, better: clauses.every((c) => c.pass)};
}
