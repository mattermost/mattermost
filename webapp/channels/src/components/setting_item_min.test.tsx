// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SettingItemMin from './setting_item_min';

describe('components/SettingItemMin', () => {
    const baseProps = {
        title: 'title',
        isDisabled: false,
        section: 'section',
        updateSection: jest.fn(),
        describe: 'describe',
    };

    test('should render component correctly', () => {
        renderWithIntl(<SettingItemMin {...baseProps}/>);

        expect(screen.getByText('title')).toBeInTheDocument();
        expect(screen.getByText('describe')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    test('should render disabled state correctly', () => {
        const props = {...baseProps, isDisabled: true};
        renderWithIntl(<SettingItemMin {...props}/>);

        expect(screen.getByText('title')).toBeInTheDocument();
        expect(screen.getByText('describe')).toBeInTheDocument();
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });

    test('should call updateSection on click when enabled', async () => {
        const updateSection = jest.fn();
        const props = {...baseProps, updateSection};
        renderWithIntl(<SettingItemMin {...props}/>);

        await userEvent.click(screen.getByText('Edit'));
        expect(updateSection).toHaveBeenCalledWith('section');
    });

    test('should call updateSection with empty string when section is empty', async () => {
        const updateSection = jest.fn();
        const props = {...baseProps, updateSection, section: ''};
        render(<SettingItemMin {...props}/>);

        await userEvent.click(screen.getByText('Edit'));
        expect(updateSection).toHaveBeenCalledWith('');
    });

    test('should not call updateSection when disabled', async () => {
        const updateSection = jest.fn();
        const props = {...baseProps, updateSection, isDisabled: true};
        render(<SettingItemMin {...props}/>);

        const title = screen.getByText('title');
        await userEvent.click(title);
        expect(updateSection).not.toHaveBeenCalled();
    });
});
