// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import AddOAuthApp from 'components/integrations/add_oauth_app/add_oauth_app';

import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AddOAuthApp', () => {
    const emptyFunction = jest.fn();
    const team = TestHelper.getTeamMock({
        id: 'dbcxd9wpzpbpfp8pad78xj12pr',
        name: 'test',
    });

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AddOAuthApp
                team={team}
                actions={{addOAuthApp: emptyFunction}}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
