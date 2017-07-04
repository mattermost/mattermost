// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import * as Utils from 'utils/utils.jsx';
import AddCommand from 'components/integrations/components/add_command/add_command.jsx';

describe('components/integrations/AddCommand', () => {
    test('should match snapshot', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function
        const teamId = Utils.generateId();

        const wrapper = shallow(
            <AddCommand
                team={{
                    id: teamId,
                    name: 'test'
                }}
                addCommandRequest={{
                    status: 'not_started',
                    error: null
                }}
                actions={{addCommand: emptyFunction}}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });
});
