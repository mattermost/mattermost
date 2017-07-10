// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import * as Utils from 'utils/utils.jsx';
import InstalledCommand from 'components/integrations/components/installed_command.jsx';

describe('components/integrations/InstalledCommand', () => {
    const emptyFunction = jest.fn();
    const command = {
        id: Utils.generateId(),
        display_name: 'test',
        description: 'test',
        trigger: 'test',
        auto_complete: 'test',
        auto_complete_hint: 'test',
        token: 'testToken',
        create_at: '1499722850203'
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <InstalledCommand
                team={{
                    name: 'test'
                }}
                command={command}
                onRegenToken={emptyFunction}
                onDelete={emptyFunction}
                creator={{
                    username: 'test'
                }}
                canChange={true}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should call onRegenToken function', () => {
        const onRegenToken = jest.fn();
        const wrapper = shallow(
            <InstalledCommand
                team={{
                    name: 'test'
                }}
                command={command}
                onRegenToken={onRegenToken}
                onDelete={emptyFunction}
                creator={{
                    username: 'test'
                }}
                canChange={true}
            />
        );
        wrapper.find('div.item-actions a').first().simulate('click');

        expect(onRegenToken).toBeCalled();
    });
});
