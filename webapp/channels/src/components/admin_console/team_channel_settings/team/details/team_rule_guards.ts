// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {referencesResourceAttributes} from 'components/admin_console/access_control/editors/shared';

// Early feedback only: /cel/check accepts these, and the team policy save is what rejects them.
// It also keeps a doomed rule from reaching the parent link writes, which run before the save.
export function teamRuleGuardErrorId(expression: string): 'resource_attributes' | undefined {
    if (referencesResourceAttributes(expression)) {
        return 'resource_attributes';
    }
    return undefined;
}
