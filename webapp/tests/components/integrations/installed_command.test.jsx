// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import InstalledCommand from 'components/integrations/components/installed_command.jsx';

describe('components/integrations/InstalledCommand', () => {
    const emptyFunction = jest.fn();
    const command = {
        id: 'r5tpgt4iepf45jt768jz84djic',
        display_name: 'test',
        description: 'test',
        trigger: 'trigger',
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
                filter={'trigger'}
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
                filter={''}
                creator={{
                    username: 'test'
                }}
                canChange={true}
            />
        );
        wrapper.find('div.item-actions a').first().simulate('click', {preventDefault() {
            return jest.fn();
        }});

        expect(onRegenToken).toBeCalled();
    });

    test('should filter out command', () => {
        const wrapper = shallow(
            <InstalledCommand
                team={{
                    name: 'test'
                }}
                command={command}
                onRegenToken={emptyFunction}
                onDelete={emptyFunction}
                filter={'filter'}
                creator={{
                    username: 'test'
                }}
                canChange={true}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });
});
