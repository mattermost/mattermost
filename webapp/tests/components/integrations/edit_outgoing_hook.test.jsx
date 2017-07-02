// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import EditOutgoingWebhook from 'components/integrations/components/edit_outgoing_webhook/edit_outgoing_webhook.jsx';

describe('components/integrations/EditOutgoingWebhook', () => {
    test('should match snapshot', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function
        const teamId = 'testteamid';

        const wrapper = shallow(
            <EditOutgoingWebhook
                team={{
                    id: teamId,
                    name: 'test'
                }}
                hookId={'somehookid'}
                updateOutgoingHookRequest={{
                    status: 'not_started',
                    error: null
                }}
                actions={{updateOutgoingHook: emptyFunction, getOutgoingHook: emptyFunction}}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });
});

