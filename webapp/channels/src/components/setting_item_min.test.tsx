// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import SettingItemMin from './setting_item_min';

describe('components/SettingItemMin', () => {
    const baseProps = {
        title: 'title',
        disableOpen: false,
        section: 'section',
        updateSection: jest.fn(),
        describe: 'describe',
        isMobileView: false,
        actions: {
            updateActiveSection: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SettingItemMin {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on disableOpen to true', () => {
        const props = {...baseProps, disableOpen: true};
        const wrapper = shallow(
            <SettingItemMin {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should have called updateSection on handleClick with section', () => {
        const updateSection = jest.fn();
        const props = {...baseProps, updateSection};
        const wrapper = shallow<SettingItemMin>(
            <SettingItemMin {...props}/>,
        );

        wrapper.instance().handleClick({preventDefault: jest.fn()} as any);
        expect(updateSection).toHaveBeenCalled();
        expect(updateSection).toHaveBeenCalledWith('section');
    });

    test('should have called updateSection on handleClick with empty string', () => {
        const updateSection = jest.fn();
        const props = {...baseProps, updateSection, section: ''};
        const wrapper = shallow<SettingItemMin>(
            <SettingItemMin {...props}/>,
        );

        wrapper.instance().handleClick({preventDefault: jest.fn()} as any);
        expect(updateSection).toHaveBeenCalled();
        expect(updateSection).toHaveBeenCalledWith('');
    });
});
