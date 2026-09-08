// Legacy payloads describe observations; they cannot prove upload provenance or
// that every worker report was ingested. The caller binds the requested URLs,
// current PR/status and GitHub workflow revision independently.
const failed = new Set(['failed', 'timedOut', 'interrupted']);
const passed = new Set(['passed', 'flaky']);
const terminal = new Set(['completed_pass', 'completed_fail', 'completed_skipped']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positive = value => /^[1-9][0-9]*$/.test(String(value));
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const text = value => typeof value === 'string' && value.length > 0;
const timestamp = value => text(value) && Number.isFinite(Date.parse(value));
const failureSeen = row => object(row) && (failed.has(row.status) || row.status === 'flaky' || row.run_failed === true || row.attempts_failed > 0);

function finalCase(rows) {
    if (!rows.length) return null;
    // The production Playwright payload stores each internal retry as a row.
    // Equal titles with duplicate retry numbers could instead be different tests.
    const ordered = [...rows].sort((a, b) => a.retry_count - b.retry_count);
    if (ordered.length > 1 && ordered.some((row, i) => row.retry_count !== i)) return null;
    const last = ordered.at(-1);
    if (passed.has(last.status) && last.run_failed !== true) return 'passed';
    if (failed.has(last.status) && last.run_failed !== false) return 'failed';
    return null;
}

function consolidatedOnly(consolidated) {
    if (!Array.isArray(consolidated?.specs)) return [];
    // These titles lack a reliable file/project identity. Keep separate entries,
    // including histories, without joining them to orchestration test titles.
    return consolidated.specs.filter(s => object(s) &&
        (failed.has(s.status) || s.status === 'flaky' || Array.isArray(s.history) && s.history.some(failureSeen))).map(s => ({
        file: null, full_title: text(s.full_title) ? s.full_title : null, project: null, stable_key: null,
        observation: 'legacy_attempts_unknown',
        rows: [{...s, evidence_source: 'legacy_consolidated'}],
    }));
}

export function legacyObservations(consolidated, orchestration) {
    const reasons = new Set(['legacy_worker_report_completeness_unverified']);
    const result = {group: null, tests: [], complete: false, reasons: []};
    const finish = () => ({...result, reasons: [...reasons]});
    const o = orchestration;
    if (!object(o) || !text(o.repository) || !/^[\w.-]+\/[\w.-]+$/.test(o.repository) || !sha(o.commit_sha) ||
        !positive(o.gh_run_id) || !positive(o.gh_run_attempt) || !text(o.name) || !text(o.branch) ||
        !['cypress', 'playwright'].includes(o.framework) || !o.name.startsWith(o.framework + '-')) {
        reasons.add('legacy_orchestration_identity_unavailable');
        result.tests = consolidatedOnly(consolidated);
        reasons.add('legacy_report_group_id_unavailable');
        return finish();
    }
    result.group = {repository: o.repository, commit_sha: o.commit_sha, gh_run_id: String(o.gh_run_id),
        gh_run_attempt: String(o.gh_run_attempt), name: o.name, branch: o.branch, framework: o.framework,
        ...(Number.isSafeInteger(o.gh_pr_number) ? {gh_pr_number: o.gh_pr_number} : {}),
        ...(text(o.started_at) ? {created_at: o.started_at} : {})};

    const c = consolidated;
    const consistent = object(c) && c.latest_commit_sha === o.commit_sha && String(c.latest_run_attempt) === String(o.gh_run_attempt) &&
        c.filters?.repository === o.repository && c.filters?.commit_sha === o.commit_sha && c.filters?.target_name === o.name;
    if (!consistent) reasons.add('legacy_consolidated_identity_unverified');
    if (consistent && Array.isArray(c.contributing_reports) && c.contributing_reports.length === 1 && uuid(c.contributing_reports[0])) {
        result.group.id = c.contributing_reports[0];
    } else reasons.add('legacy_report_group_id_unavailable');
    // Consolidated responses do not echo gh_run_id. Its exact query must be
    // recorded and bound by the caller even when all echoed fields match.
    reasons.add('legacy_consolidated_run_id_requires_request_binding');
    if (!Array.isArray(o.units)) {
        reasons.add('legacy_dispatch_units_unavailable');
        result.tests = consolidatedOnly(consistent ? c : null);
        return finish();
    }
    const units = o.units.filter(object);
    const unitIDs = new Map(); const paths = new Map();
    for (const unit of units) {
        paths.set(unit.spec_path, (paths.get(unit.spec_path) || 0) + 1);
        unitIDs.set(unit.id, (unitIDs.get(unit.id) || 0) + 1);
    }
    if (o.status !== 'completed' || !Number.isSafeInteger(o.total_units) || o.total_units <= 0 ||
        o.total_units !== units.length || units.length !== o.units.length || unitIDs.size !== units.length || units.some(u => !text(u.id))) {
        reasons.add('legacy_dispatch_coverage_incomplete');
    }
    if (!object(o.counts) || ['pending', 'leased', 'abandoned', 'retest_eligible'].some(k => o.counts[k] !== 0) ||
        [...terminal].some(state => o.counts?.[state] !== units.filter(u => u.state === state).length)) {
        reasons.add('legacy_dispatch_counts_inconsistent');
    }

    for (const unit of units) {
        const attempts = Array.isArray(unit.attempts) ? unit.attempts.filter(object) : [];
        let uncertain = !text(unit.spec_path) || paths.get(unit.spec_path) !== 1 || !text(unit.id) ||
            unitIDs.get(unit.id) !== 1 || !terminal.has(unit.state) || o.status !== 'completed';
        if (uncertain) reasons.add('legacy_unit_identity_or_state_unresolved');
        if (!Array.isArray(unit.attempts) || attempts.length !== unit.attempts.length ||
            attempts.some(a => !text(a.id) || a.spec_path !== unit.spec_path || !positive(a.gh_job_id) || !text(a.gh_job_name) ||
                a.expired !== false || a.late_report !== false) || new Set(attempts.map(a => a.id)).size !== attempts.length) {
            uncertain = true;
            reasons.add('legacy_execution_identity_unresolved');
        }
        const final = attempts.filter(a => timestamp(unit.outcome_set_at) && a.reported_at === unit.outcome_set_at);
        const execution = final.length === 1 ? final[0] : null;
        const compatible = execution && (unit.state === 'completed_fail' ? failed.has(execution.status) :
            unit.state === 'completed_pass' ? passed.has(execution.status) : unit.state === 'completed_skipped' && execution.status === 'skipped');
        if (!compatible) { uncertain = true; reasons.add('legacy_final_execution_unresolved'); }
        const identities = new Map();
        let observedFinalFailure = false;
        let observedFailureCase = false;
        for (const attempt of attempts) {
            if (!Array.isArray(attempt.test_cases) || attempt.test_cases.some(t => !object(t) || !text(t.full_title))) {
                uncertain = true;
                reasons.add('legacy_test_identity_unavailable');
            }
            const {test_cases: cases, ...executionData} = attempt;
            for (const row of Array.isArray(cases) ? cases.filter(object) : []) {
                const key = JSON.stringify([unit.spec_path, row.full_title ?? null, row.project ?? null]);
                if (!identities.has(key)) identities.set(key, []);
                identities.get(key).push({...row, execution: executionData, unit_id: unit.id, unit_state: unit.state, final_execution: execution?.id === attempt.id});
            }
        }
        for (const rows of identities.values()) {
            const finalRows = rows.filter(r => execution && r.execution.id === execution.id);
            const outcome = finalCase(finalRows);
            observedFinalFailure ||= outcome === 'failed';
            if (!rows.some(failureSeen)) continue;
            observedFailureCase = true;
            const first = rows[0];
            const keys = new Set(rows.map(r => r.stable_key).filter(text));
            const ambiguousHistory = [...new Set(rows.map(r => r.execution.id))].some(id =>
                finalCase(rows.filter(r => r.execution.id === id)) === null) || keys.size > 1;
            let observation = 'legacy_attempts_unknown';
            if (!uncertain && !ambiguousHistory && text(first.full_title) && outcome === 'failed' && unit.state === 'completed_fail') observation = 'final_failure';
            else if (!uncertain && !ambiguousHistory && text(first.full_title) && outcome === 'passed') observation = 'retry_survivor';
            if (observation === 'legacy_attempts_unknown') reasons.add('legacy_test_final_outcome_unresolved');
            if (o.framework === 'playwright' && !text(first.project)) reasons.add('legacy_playwright_project_unavailable');
            result.tests.push({file: text(unit.spec_path) ? unit.spec_path : null, full_title: text(first.full_title) ? first.full_title : null, project: text(first.project) ? first.project : null,
                stable_key: keys.size === 1 && text(first.stable_key) ? first.stable_key : null, observation, rows});
        }
        if (unit.state === 'completed_fail' && !observedFinalFailure) {
            reasons.add('legacy_failed_unit_without_final_failed_case');
            result.tests.push({file: text(unit.spec_path) ? unit.spec_path : null, full_title: null, project: null, stable_key: null,
                observation: 'legacy_attempts_unknown', rows: attempts.map(a => ({...a, unit_id: unit.id, unit_state: unit.state}))});
        } else if (!observedFailureCase && attempts.some(a => failed.has(a.status) || a.status === 'flaky')) {
            reasons.add('legacy_failed_execution_without_failed_case');
            result.tests.push({file: text(unit.spec_path) ? unit.spec_path : null, full_title: null, project: null, stable_key: null,
                observation: 'legacy_attempts_unknown', rows: attempts.map(a => ({...a, unit_id: unit.id, unit_state: unit.state}))});
        }
    }
    return finish();
}
