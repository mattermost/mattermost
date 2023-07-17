// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';
import {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import ActionButton from './action_button';

describe('components/post_view/message_attachments/action_button.jsx', () => {
    const baseProps = {
        action: {id: 'action_id_1', name: 'action_name_1', cookie: 'cookie-contents'},
        handleAction: jest.fn(),
        theme: Preferences.THEMES.denim as unknown as Theme,
    };

    test('should match default component state with given props', () => {
        render(<ActionButton {...baseProps}/>);

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('data-action-cookie', 'cookie-contents');
        expect(button).toHaveAttribute('data-action-id', 'action_id_1');

        const loadingIcon = screen.getByTitle('Loading Icon');
        expect(loadingIcon).toHaveClass('fa fa-spinner fa-fw fa-pulse spinner');
    });

    test('should call handleAction on click', () => {
        render(<ActionButton {...baseProps}/>);

        const button = screen.getByRole('button');

        userEvent.click(button);

        expect(baseProps.handleAction).toHaveBeenCalledTimes(1);
    });

    test('should have correct styles when provided color from theme', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: 'onlineIndicator'},
        };

        render(<ActionButton {...props}/>);

        const button = screen.getByRole('button');

        expect(button).toHaveStyle(`borderColor: ${changeOpacity(Preferences.THEMES.denim.onlineIndicator, 0.25)}`);
        expect(button).toHaveStyle('borderWidth: 2');
        expect(button).toHaveStyle(`color: ${Preferences.THEMES.denim.onlineIndicator}`);
    });

    test('should have correct styles when provided color from not default theme', () => {
        const props = {
            ...baseProps,
            theme: Preferences.THEMES.indigo as unknown as Theme,
            action: {...baseProps.action, style: 'danger'},
        };

        render(<ActionButton {...props}/>);

        const button = screen.getByRole('button');

        expect(button).toHaveStyle(`borderColor: ${changeOpacity(Preferences.THEMES.indigo.errorTextColor, 0.25)}`);
        expect(button).toHaveStyle('borderWidth: 2');
        expect(button).toHaveStyle(`color: ${Preferences.THEMES.indigo.errorTextColor}`);
    });

    test('should have correct styles when provided status color', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: 'success'},
        };

        render(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        expect(button).toHaveStyle(`borderColor: ${changeOpacity(Preferences.THEMES.denim.onlineIndicator, 0.25)}`);
        expect(button).toHaveStyle('borderWidth: 2');
        expect(button).toHaveStyle(`color: ${Preferences.THEMES.denim.onlineIndicator}`);
    });

    test('should have correct styles when provided hex color', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: '#28a745'},
        };

        render(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        expect(button).toHaveStyle(`borderColor: ${changeOpacity(props.action.style, 0.25)}`);
        expect(button).toHaveStyle('borderWidth: 2');
        expect(button).toHaveStyle(`color: ${props.action.style}`);
    });

    test('should have no styles when provided invalid hex color', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: '#wrong'},
        };

        render(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        expect(button.style.length).toBe(0);
    });

    test('should have no styles when provided undefined', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: undefined},
        };

        render(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        expect(button.style.length).toBe(0);
    });
});
