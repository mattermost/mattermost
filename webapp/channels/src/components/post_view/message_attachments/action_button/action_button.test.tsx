// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ActionButton from './action_button';

describe('components/post_view/message_attachments/action_button.jsx', () => {
    const baseProps = {
        action: {id: 'action_id_1', name: 'action_name_1', cookie: 'cookie-contents'},
        handleAction: jest.fn(),
        theme: Preferences.THEMES.denim as unknown as Theme,
    };

    test('should match default component state with given props', () => {
        renderWithContext(<ActionButton {...baseProps}/>);

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('data-action-cookie', 'cookie-contents');
        expect(button).toHaveAttribute('data-action-id', 'action_id_1');

        const loadingIcon = screen.getByTitle('Loading Icon');
        expect(loadingIcon).toHaveClass('fa fa-spinner fa-fw fa-pulse spinner');
    });

    test('should call handleAction on click', () => {
        renderWithContext(<ActionButton {...baseProps}/>);

        const button = screen.getByRole('button');

        userEvent.click(button);

        expect(baseProps.handleAction).toHaveBeenCalledTimes(1);
    });

    test('should have correct styles when provided color from theme', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: 'onlineIndicator'},
        };

        renderWithContext(<ActionButton {...props}/>);

        const button = screen.getByRole('button');

        expect(button).toHaveStyle(`background-color: ${changeOpacity(Preferences.THEMES.denim.onlineIndicator, 0.08)}`);
        expect(button).toHaveStyle(`color: ${Preferences.THEMES.denim.onlineIndicator}`);
    });

    test('should have correct styles when provided color from not default theme', () => {
        const props = {
            ...baseProps,
            theme: Preferences.THEMES.indigo as unknown as Theme,
            action: {...baseProps.action, style: 'danger'},
        };

        renderWithContext(<ActionButton {...props}/>);

        const button = screen.getByRole('button');

        expect(button).toHaveStyle(`background-color: ${changeOpacity(Preferences.THEMES.indigo.errorTextColor, 0.08)}`);
        expect(button).toHaveStyle(`color: ${Preferences.THEMES.indigo.errorTextColor}`);
    });

    test('should have correct styles when provided status color', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: 'success'},
        };

        renderWithContext(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        expect(button).toHaveStyle(`background-color: ${changeOpacity('#339970', 0.08)}`);
        expect(button).toHaveStyle(`color: ${'#339970'}`);
    });

    test('should have correct styles when provided hex color', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: '#28a745'},
        };

        renderWithContext(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        expect(button).toHaveStyle(`background-color: ${changeOpacity(props.action.style, 0.08)}`);
        expect(button).toHaveStyle(`color: ${props.action.style}`);
    });

    test('should have no styles when provided invalid hex color', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: '#wrong'},
        };

        renderWithContext(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        expect(button.style.length).toBe(0);
    });

    test('should have no styles when provided undefined', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: undefined},
        };

        renderWithContext(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        expect(button.style.length).toBe(0);
    });
});
