// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {referencesResourceAttributes} from 'components/admin_console/access_control/editors/shared';

// Team membership rules can't use these; /cel/check accepts them but the save rejects them.
export function teamRuleGuardErrorId(expression: string): 'resource_attributes' | 'session_attributes' | undefined {
    if (referencesResourceAttributes(expression)) {
        return 'resource_attributes';
    }

    // Same lexical test as the server (model/access_policy.go).
    if (expression.includes('user.session')) {
        return 'session_attributes';
    }
    return undefined;
}
