// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import AddOutgoingOAuthConnection from 'components/integrations/outgoing_oauth_connections/add_outgoing_oauth_connection';

import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AddOutgoingOAuthConnection', () => {
    const team = TestHelper.getTeamMock({
        id: 'dbcxd9wpzpbpfp8pad78xj12pr',
        name: 'test',
    });

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AddOutgoingOAuthConnection
                team={team}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
