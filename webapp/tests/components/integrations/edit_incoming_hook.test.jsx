// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

 import React from 'react';
 import {shallow} from 'enzyme';

 import EditIncomingWebhook from 'components/integrations/components/edit_incoming_webhook/edit_incoming_webhook.jsx';

 describe('components/integrations/EditIncomingWebhook', () => {
     test('should match snapshot', () => {
         function emptyFunction() {} //eslint-disable-line no-empty-function
         const teamId = 'testteamid';

         const wrapper = shallow(
             <EditIncomingWebhook
                 team={{
                     id: teamId,
                     name: 'test'
                 }}
                 hookId={'somehookid'}
                 updateIncomingHookRequest={{
                     status: 'not_started',
                     error: null
                 }}
                 actions={{updateIncomingHook: emptyFunction, getIncomingHook: emptyFunction}}
             />
         );
         expect(wrapper).toMatchSnapshot();
     });
 });
