// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';
import {Preferences} from 'mattermost-redux/constants';

import ActionButton from 'components/post_view/message_attachments/action_button/action_button';

describe('components/post_view/message_attachments/action_button.jsx', () => {
    const baseProps = {
        action: {id: 'action_id_1', name: 'action_name_1', cookie: 'cookie-contents'},
        handleAction: jest.fn(),
        theme: Preferences.THEMES.denim as unknown as Theme,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<ActionButton {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should call handleAction on click', () => {
        const wrapper = shallow(<ActionButton {...baseProps}/>);

        wrapper.find('button').simulate('click');

        expect(baseProps.handleAction).toHaveBeenCalledTimes(1);
    });

    test('should have correct styles when provided color from theme', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: 'onlineIndicator'},
        };

        const wrapper = shallow(<ActionButton {...props}/>);
        const buttonStyles = wrapper.find('button').prop('style');

        expect(buttonStyles).toHaveProperty('borderColor', changeOpacity(Preferences.THEMES.denim.onlineIndicator, 0.25));
        expect(buttonStyles).toHaveProperty('borderWidth', 2);
        expect(buttonStyles).toHaveProperty('color', Preferences.THEMES.denim.onlineIndicator);
    });

    test('should have correct styles when provided color from not default theme', () => {
        const props = {
            ...baseProps,
            theme: Preferences.THEMES.indigo as unknown as Theme,
            action: {...baseProps.action, style: 'danger'},
        };

        const wrapper = shallow(<ActionButton {...props}/>);
        const buttonStyles = wrapper.find('button').prop('style');

        expect(buttonStyles).toHaveProperty('borderColor', changeOpacity(Preferences.THEMES.indigo.errorTextColor, 0.25));
        expect(buttonStyles).toHaveProperty('borderWidth', 2);
        expect(buttonStyles).toHaveProperty('color', Preferences.THEMES.indigo.errorTextColor);
    });

    test('should have correct styles when provided status color', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: 'success'},
        };

        const wrapper = shallow(<ActionButton {...props}/>);
        const buttonStyles = wrapper.find('button').prop('style');

        expect(buttonStyles).toHaveProperty('borderColor', changeOpacity(Preferences.THEMES.denim.onlineIndicator, 0.25));
        expect(buttonStyles).toHaveProperty('borderWidth', 2);
        expect(buttonStyles).toHaveProperty('color', Preferences.THEMES.denim.onlineIndicator);
    });

    test('should have correct styles when provided hex color', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: '#28a745'},
        };

        const wrapper = shallow(<ActionButton {...props}/>);
        const buttonStyles = wrapper.find('button').prop('style');

        expect(buttonStyles).toHaveProperty('borderColor', changeOpacity(props.action.style, 0.25));
        expect(buttonStyles).toHaveProperty('borderWidth', 2);
        expect(buttonStyles).toHaveProperty('color', props.action.style);
    });

    test('should have no styles when provided invalid hex color', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: '#wrong'},
        };

        const wrapper = shallow(<ActionButton {...props}/>);
        const buttonStyles = wrapper.find('button').prop('style');

        expect(buttonStyles).toBeUndefined();
    });

    test('should have no styles when provided undefined', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: undefined},
        };

        const wrapper = shallow(<ActionButton {...props}/>);
        const buttonStyles = wrapper.find('button').prop('style');

        expect(buttonStyles).toBeUndefined();
    });
});
