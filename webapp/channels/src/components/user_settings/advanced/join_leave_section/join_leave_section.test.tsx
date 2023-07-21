// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import JoinLeaveSection from 'components/user_settings/advanced/join_leave_section/join_leave_section';

import {AdvancedSections} from 'utils/constants';

describe('components/user_settings/advanced/JoinLeaveSection', () => {
    const defaultProps = {
        active: false,
        areAllSectionsInactive: false,
        currentUserId: 'current_user_id',
        joinLeave: 'true',
        onUpdateSection: jest.fn(),
        renderOnOffLabel: jest.fn(),
        actions: {
            savePreferences: jest.fn(() => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            }),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <JoinLeaveSection {...defaultProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(SettingItemMax).exists()).toEqual(false);
        expect(wrapper.find(SettingItemMin).exists()).toEqual(true);

        wrapper.setProps({active: true});
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(SettingItemMax).exists()).toEqual(true);
        expect(wrapper.find(SettingItemMin).exists()).toEqual(false);
    });

    test('should match state on handleOnChange', () => {
        const wrapper = shallow<JoinLeaveSection>(
            <JoinLeaveSection {...defaultProps}/>,
        );

        wrapper.setState({joinLeaveState: 'true'});

        let value = 'false';
        wrapper.instance().handleOnChange({currentTarget: {value}} as any);
        expect(wrapper.state('joinLeaveState')).toEqual('false');

        value = 'true';
        wrapper.instance().handleOnChange({currentTarget: {value}} as any);
        expect(wrapper.state('joinLeaveState')).toEqual('true');
    });

    test('should call props.actions.savePreferences and props.onUpdateSection on handleSubmit', () => {
        const actions = {
            savePreferences: jest.fn().mockImplementation(() => Promise.resolve({data: true})),
        };
        const onUpdateSection = jest.fn();
        const wrapper = shallow<JoinLeaveSection>(
            <JoinLeaveSection
                {...defaultProps}
                actions={actions}
                onUpdateSection={onUpdateSection}
            />,
        );

        const joinLeavePreference = {
            category: 'advanced_settings',
            name: 'join_leave',
            user_id: 'current_user_id',
            value: 'true',
        };

        const instance = wrapper.instance();
        instance.handleSubmit();
        expect(actions.savePreferences).toHaveBeenCalledTimes(1);
        expect(actions.savePreferences).toHaveBeenCalledWith('current_user_id', [joinLeavePreference]);
        expect(onUpdateSection).toHaveBeenCalledTimes(1);

        wrapper.setState({joinLeaveState: 'false'});
        joinLeavePreference.value = 'false';
        instance.handleSubmit();
        expect(actions.savePreferences).toHaveBeenCalledTimes(2);
        expect(actions.savePreferences).toHaveBeenCalledWith('current_user_id', [joinLeavePreference]);
    });

    test('should match state and call props.onUpdateSection on handleUpdateSection', () => {
        const onUpdateSection = jest.fn();
        const wrapper = shallow<JoinLeaveSection>(
            <JoinLeaveSection
                {...defaultProps}
                onUpdateSection={onUpdateSection}
            />,
        );

        wrapper.setState({joinLeaveState: 'false'});

        const instance = wrapper.instance();
        instance.handleUpdateSection();
        expect(wrapper.state('joinLeaveState')).toEqual(defaultProps.joinLeave);
        expect(onUpdateSection).toHaveBeenCalledTimes(1);

        wrapper.setState({joinLeaveState: 'false'});
        instance.handleUpdateSection(AdvancedSections.JOIN_LEAVE);
        expect(onUpdateSection).toHaveBeenCalledTimes(2);
        expect(onUpdateSection).toBeCalledWith(AdvancedSections.JOIN_LEAVE);
    });
});
