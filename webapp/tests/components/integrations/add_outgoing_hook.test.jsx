// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import AddOutgoingWebhook from 'components/integrations/components/add_outgoing_webhook/add_outgoing_webhook.jsx';

describe('components/integrations/AddOutgoingWebhook', () => {
    test('should match snapshot', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function
        const teamId = 'testteamid';

        const wrapper = shallow(
            <AddOutgoingWebhook
                team={{
                    id: teamId,
                    name: 'test'
                }}
                createOutgoingHookRequest={{
                    status: 'not_started',
                    error: null
                }}
                actions={{createOutgoingHook: emptyFunction}}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });
});
