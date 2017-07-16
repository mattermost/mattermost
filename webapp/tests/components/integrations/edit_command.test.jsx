// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import EditCommand from 'components/integrations/components/edit_command/edit_command.jsx';

describe('components/integrations/EditCommand', () => {
    test('should match snapshot', () => {
        const emptyFunction = jest.fn();
        const id = 'r5tpgt4iepf45jt768jz84djic';
        global.window.mm_config = {};
        global.window.mm_config.EnableCommands = 'true';

        const wrapper = shallow(
            <EditCommand
                team={{
                    id,
                    name: 'test'
                }}
                commandId={id}
                commands={[]}
                editCommandRequest={{
                    status: 'not_started',
                    error: null
                }}
                actions={{
                    getCustomTeamCommands: emptyFunction,
                    editCommand: emptyFunction
                }}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });
});