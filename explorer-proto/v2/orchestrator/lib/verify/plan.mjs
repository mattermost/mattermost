// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The plan a `--dry-run` of a verify-spec run writes: what would run, with which image, verifier and commands. It
// needs no Docker and holds no id, port, origin or credential.
import path from 'node:path';

import {DEFAULT_TIMEOUT_SECONDS, portableArgv, verifierArgv} from './handoff.mjs';

import {EXIT_MEANING, ORCH_REPO_PATH, STAGE_SETS} from '../common.mjs';
import {engineArgv} from '../engine.mjs';
import {effectiveImage, infraTarget} from '../stages/stage0_target.mjs';

const SCRIPTS = 'explorer-proto/infra/scripts';

export function buildPlan(cfg) {
    const session = cfg.session;
    const target = cfg.image ? [] : [`--target=${infraTarget(cfg.target)}`];
    const engine = {kind: 'session', name: session};
    const processMode = cfg.verifier === 'process';
    const runDir = '<run>';
    return {
        schema: 'explorer-run-plan/v1',
        run_id: cfg.runId,
        target: cfg.target,
        session,
        live: Boolean(cfg.live),
        spec: {path: cfg.verifySpec.path, sha256: cfg.verifySpec.sha256},
        control: cfg.control.id,
        image: {
            source: cfg.image ? 'override' : 'target-pin',
            reference: effectiveImage(cfg.target, cfg),
        },
        verifier: {
            mode: processMode ? 'process' : 'manual',
            timeout_seconds: cfg.verifierTimeout ?? DEFAULT_TIMEOUT_SECONDS,
            ...(processMode
                ? {
                      command: portableArgv(
                          verifierArgv({
                              task: path.join(runDir, 'verify', 'agent-task.json'),
                              trace: path.join(runDir, '2-control', 'failure-trace.json'),
                              out: path.join(runDir, 'verify', 'agent-result.json'),
                              nonceFile: path.join('<scratch>', 'dispatch-binding.json'),
                          }),
                          {run: runDir, scratch: '<scratch>'},
                      ),
                  }
                : {}),
        },
        stages: STAGE_SETS.verify_spec.dirs,
        commands: [
            ['bash', `${SCRIPTS}/gate.sh`, '--keep', ...target],
            ['bash', `${SCRIPTS}/up.sh`, ...target, `--session=${session}`],
            engineArgv('replay', engine),
            ['node', `${SCRIPTS}/bookmark_ctl.mjs`, 'patch', '--channel=<control channel>', "--title='<title>'"],
            ['bash', `${SCRIPTS}/down.sh`],
            ...(processMode ? [['node', `${ORCH_REPO_PATH}/verifier/bookmarks_verifier.mjs`, '...']] : []),
        ],
        exit_codes: Object.fromEntries(Object.entries(EXIT_MEANING).map(([k, v]) => [k, v])),
    };
}
