// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The five stages that verify an existing spec: target (stage 0, shared), baseline, control, dispatch, collect.
import baseline from './stage_baseline.mjs';
import collect from './stage_collect.mjs';
import control from './stage_control.mjs';
import dispatch from './stage_dispatch.mjs';

import target from '../stages/stage0_target.mjs';

export const VERIFY_STAGES = [target, baseline, control, dispatch, collect];
