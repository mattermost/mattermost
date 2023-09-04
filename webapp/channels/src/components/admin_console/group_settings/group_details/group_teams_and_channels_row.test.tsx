// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import GroupTeamsAndChannelsRow from 'components/admin_console/group_settings/group_details/group_teams_and_channels_row';

describe('components/admin_console/group_settings/group_details/GroupTeamsAndChannelsRow', () => {
    for (const type of [
        'public-team',
        'private-team',
        'public-channel',
        'private-channel',
    ]) {
        test('should match snapshot, for ' + type, () => {
            const wrapper = shallow(
                <GroupTeamsAndChannelsRow
                    id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                    type={type}
                    name={'Test ' + type}
                    hasChildren={false}
                    collapsed={false}
                    onRemoveItem={jest.fn()}
                    onToggleCollapse={jest.fn()}
                    onChangeRoles={jest.fn()}
                />,
            );
            expect(wrapper).toMatchSnapshot();
        });
    }
    test('should match snapshot, when has children', () => {
        const wrapper = shallow(
            <GroupTeamsAndChannelsRow
                id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                type='public-team'
                name={'Test team with children'}
                hasChildren={true}
                collapsed={false}
                onRemoveItem={jest.fn()}
                onToggleCollapse={jest.fn()}
                onChangeRoles={jest.fn()}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, when has children and is collapsed', () => {
        const wrapper = shallow(
            <GroupTeamsAndChannelsRow
                id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                type='public-team'
                name={'Test team with children'}
                hasChildren={true}
                collapsed={true}
                onRemoveItem={jest.fn()}
                onToggleCollapse={jest.fn()}
                onChangeRoles={jest.fn()}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should call onToggleCollapse on caret click', () => {
        const onToggleCollapse = jest.fn();
        const wrapper = shallow(
            <GroupTeamsAndChannelsRow
                id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                type='public-team'
                name={'Test team with children'}
                hasChildren={true}
                collapsed={true}
                onRemoveItem={jest.fn()}
                onToggleCollapse={onToggleCollapse}
                onChangeRoles={jest.fn()}
            />,
        );
        wrapper.find('.fa-caret-right').simulate('click');
        expect(onToggleCollapse).toBeCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx');
    });

    test('should call onRemoveItem on remove link click', () => {
        const onRemoveItem = jest.fn();
        const wrapper = shallow<GroupTeamsAndChannelsRow>(
            <GroupTeamsAndChannelsRow
                id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                type='public-team'
                name={'Test team with children'}
                hasChildren={true}
                collapsed={true}
                onRemoveItem={onRemoveItem}
                onToggleCollapse={jest.fn()}
                onChangeRoles={jest.fn()}
            />,
        );
        wrapper.find('.btn-link').simulate('click');
        expect(wrapper.instance().state.showConfirmationModal).toEqual(true);
        wrapper.instance().removeItem();
        expect(onRemoveItem).toBeCalledWith(
            'xxxxxxxxxxxxxxxxxxxxxxxxxx',
            'public-team',
        );
        expect(wrapper.instance().state.showConfirmationModal).toEqual(false);
    });
});
