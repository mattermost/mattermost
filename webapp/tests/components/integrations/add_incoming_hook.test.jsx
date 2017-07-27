// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

 import React from 'react';
 import {shallow} from 'enzyme';

 import AddIncomingWebhook from 'components/integrations/components/add_incoming_webhook/add_incoming_webhook.jsx';

 describe('components/integrations/AddIncomingWebhook', () => {
     test('should match snapshot', () => {
         function emptyFunction() {} //eslint-disable-line no-empty-function
         const teamId = 'testteamid';

         const wrapper = shallow(
             <AddIncomingWebhook
                 team={{
                     id: teamId,
                     name: 'test'
                 }}
                 createIncomingHookRequest={{
                     status: 'not_started',
                     error: null
                 }}
                 actions={{createIncomingHook: emptyFunction}}
             />
         );
         expect(wrapper).toMatchSnapshot();
     });
 });
