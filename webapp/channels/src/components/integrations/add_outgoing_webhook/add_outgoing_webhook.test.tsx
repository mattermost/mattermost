// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import AddOutgoingWebhook from 'components/integrations/add_outgoing_webhook/add_outgoing_webhook';

import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AddOutgoingWebhook', () => {
    test('should match snapshot', () => {
        const emptyFunction = jest.fn();
        const team = TestHelper.getTeamMock({
            id: 'testteamid',
            name: 'test',
        });

        const wrapper = shallow(
            <AddOutgoingWebhook
                team={team}
                actions={{createOutgoingHook: emptyFunction}}
                enablePostUsernameOverride={false}
                enablePostIconOverride={false}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
