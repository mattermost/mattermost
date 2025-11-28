// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';

import {TeamModes} from './team_modes';

describe('admin_console/team_channel_settings/team/TeamModes', () => {
    test('should match snapshot', () => {
        const {container} = renderWithIntl(
            <TeamModes
                onToggle={vi.fn()}
                syncChecked={false}
                allAllowedChecked={false}
                allowedDomains={''}
                allowedDomainsChecked={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
