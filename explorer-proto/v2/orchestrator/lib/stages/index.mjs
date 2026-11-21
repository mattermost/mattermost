// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import target from './stage0_target.mjs';
import index from './stage1_index.mjs';
import explore from './stage2_explore.mjs';
import triage from './stage3_triage.mjs';
import select from './stage4_select.mjs';
import discover from './stage5_discover.mjs';
import emit from './stage6_emit.mjs';
import verify from './stage7_verify.mjs';
import promote from './stage8_promote.mjs';
import lessons from './stage9_lessons.mjs';

export const STAGES = [target, index, explore, triage, select, discover, emit, verify, promote, lessons];
