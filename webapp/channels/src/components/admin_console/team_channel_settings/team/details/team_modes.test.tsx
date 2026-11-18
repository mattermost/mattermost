// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {TeamModes} from './team_modes';

describe('admin_console/team_channel_settings/team/TeamModes', () => {
    // AdminSettingsSwitch's row wrapper carries no testid once the switch has a scoped one; it holds the switch's label.
    const syncGroupsRow = () => screen.getByTestId('admin.team.sync_groups--switch').closest('label')!.parentElement!;

    test('keeps separator under Sync Group Members when synced and ABAC row follows', () => {
        renderWithContext(
            <TeamModes
                onToggle={jest.fn()}
                syncChecked={true}
                allAllowedChecked={false}
                allowedDomains={''}
                allowedDomainsChecked={false}
                isLicensedForLDAPGroups={true}
                abacSupported={true}
                policyEnforced={false}
                policyEnforcedToggleAvailable={false}
            />,
        );

        expect(screen.getByTestId('admin.team.policy_enforce--switch')).toBeInTheDocument();

        const syncRow = syncGroupsRow();
        expect(syncRow.nextElementSibling).toHaveClass('section-separator');
    });

    test('omits separator under Sync Group Members when synced and no following row', () => {
        renderWithContext(
            <TeamModes
                onToggle={jest.fn()}
                syncChecked={true}
                allAllowedChecked={false}
                allowedDomains={''}
                allowedDomainsChecked={false}
                isLicensedForLDAPGroups={true}
                abacSupported={false}
            />,
        );

        expect(screen.queryByTestId('admin.team.policy_enforce--switch')).not.toBeInTheDocument();

        const syncRow = syncGroupsRow();
        expect(syncRow.nextElementSibling).toBeNull();
    });
});
