// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import noDispatchGetState from './no-dispatch-getstate.js';
import noRedundantAdminConfigDeps from './no-redundant-admin-config-deps.js';
import playwrightEnsureFeatureFlagTopLevel from './playwright-ensure-feature-flag-top-level.js';
import useExternalLink from './use-external-link.js';

export default {
    'no-dispatch-getstate': noDispatchGetState,
    'no-redundant-admin-config-deps': noRedundantAdminConfigDeps,
    'playwright-ensure-feature-flag-top-level': playwrightEnsureFeatureFlagTopLevel,
    'use-external-link': useExternalLink,
};
