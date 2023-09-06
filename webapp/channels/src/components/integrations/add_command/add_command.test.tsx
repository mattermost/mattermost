// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import AddCommand from 'components/integrations/add_command/add_command';

import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AddCommand', () => {
    test('should match snapshot', () => {
        const emptyFunction = jest.fn();
        const team = TestHelper.getTeamMock({name: 'test'});

        const wrapper = shallow(
            <AddCommand
                team={team}
                actions={{addCommand: emptyFunction}}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
