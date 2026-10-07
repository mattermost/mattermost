// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {teamRuleGuardErrorId} from './team_rule_guards';

describe('teamRuleGuardErrorId', () => {
    test('flags resource attribute references', () => {
        expect(teamRuleGuardErrorId('resource.attributes.Program == "x"')).toBe('resource_attributes');
    });

    test('ignores resource attribute text inside a string literal', () => {
        expect(teamRuleGuardErrorId('user.attributes.Program == "resource.attributes.x"')).toBeUndefined();
    });

    test('flags session attribute references', () => {
        expect(teamRuleGuardErrorId('user.session.ip == "1.2.3.4"')).toBe('session_attributes');
    });

    test('accepts plain user attribute rules', () => {
        expect(teamRuleGuardErrorId('user.attributes.Department == "Engineering" || user.attributes.Location == "EU"')).toBeUndefined();
    });
});
