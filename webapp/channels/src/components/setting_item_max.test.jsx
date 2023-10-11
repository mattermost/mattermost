// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import SettingItemMax from 'components/setting_item_max';

import Constants from 'utils/constants';

describe('components/SettingItemMax', () => {
    const baseProps = {
        inputs: ['input_1'],
        clientError: '',
        serverError: '',
        infoPosition: 'bottom',
        section: 'section',
        updateSection: jest.fn(),
        setting: 'setting',
        submit: jest.fn(),
        saving: false,
        title: 'title',
        width: 'full',
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SettingItemMax {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, without submit', () => {
        const props = {...baseProps, submit: null};
        const wrapper = shallow(
            <SettingItemMax {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on clientError', () => {
        const props = {...baseProps, clientError: 'clientError'};
        const wrapper = shallow(
            <SettingItemMax {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on serverError', () => {
        const props = {...baseProps, serverError: 'serverError'};
        const wrapper = shallow(
            <SettingItemMax {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should have called updateSection on handleUpdateSection with section', () => {
        const updateSection = jest.fn();
        const props = {...baseProps, updateSection};
        const wrapper = shallow(
            <SettingItemMax {...props}/>,
        );

        wrapper.instance().handleUpdateSection({preventDefault: jest.fn()});
        expect(updateSection).toHaveBeenCalled();
        expect(updateSection).toHaveBeenCalledWith('section');
    });

    test('should have called updateSection on handleUpdateSection with empty string', () => {
        const updateSection = jest.fn();
        const props = {...baseProps, updateSection, section: ''};
        const wrapper = shallow(
            <SettingItemMax {...props}/>,
        );

        wrapper.instance().handleUpdateSection({preventDefault: jest.fn()});
        expect(updateSection).toHaveBeenCalled();
        expect(updateSection).toHaveBeenCalledWith('');
    });

    test('should have called submit on handleSubmit with setting', () => {
        const submit = jest.fn();
        const props = {...baseProps, submit};
        const wrapper = shallow(
            <SettingItemMax {...props}/>,
        );

        wrapper.instance().handleSubmit({preventDefault: jest.fn()});
        expect(submit).toHaveBeenCalled();
        expect(submit).toHaveBeenCalledWith('setting');
    });

    test('should have called submit on handleSubmit with empty string', () => {
        const submit = jest.fn();
        const props = {...baseProps, submit, setting: ''};
        const wrapper = shallow(
            <SettingItemMax {...props}/>,
        );

        wrapper.instance().handleSubmit({preventDefault: jest.fn()});
        expect(submit).toHaveBeenCalled();
        expect(submit).toHaveBeenCalledWith();
    });

    it('should have called submit on handleSubmit onKeyDown ENTER', () => {
        const submit = jest.fn();
        const props = {...baseProps, submit};
        const wrapper = shallow(
            <SettingItemMax {...props}/>,
        );
        const instance = wrapper.instance();

        instance.onKeyDown({preventDefault: jest.fn(), key: Constants.KeyCodes.ENTER[0], target: {tagName: 'SELECT', classList: {contains: jest.fn()}, parentElement: {className: 'react-select__input'}}});
        expect(submit).toHaveBeenCalledTimes(0);

        instance.settingList.current = {contains: jest.fn(() => true)};
        instance.onKeyDown({preventDefault: jest.fn(), key: Constants.KeyCodes.ENTER[0], target: {tagName: '', classList: {contains: jest.fn()}, parentElement: {className: ''}}});
        expect(submit).toHaveBeenCalledTimes(1);
        expect(submit).toHaveBeenCalledWith('setting');
    });

    test('should match snapshot, with new saveTextButton', () => {
        const props = {...baseProps, saveButtonText: 'CustomText'};
        const wrapper = shallow(
            <SettingItemMax {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
