// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import AddOutgoingWebhook from 'components/integrations/add_outgoing_webhook/add_outgoing_webhook';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AddOutgoingWebhook', () => {
    test('should match snapshot', () => {
        const emptyFunction = vi.fn();
        const team = TestHelper.getTeamMock({
            id: 'testteamid',
            name: 'test',
        });

        const {container} = renderWithContext(
            <AddOutgoingWebhook
                team={team}
                actions={{createOutgoingHook: emptyFunction}}
                enablePostUsernameOverride={false}
                enablePostIconOverride={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
