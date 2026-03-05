// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SettingItemMin from './setting_item_min';

describe('components/SettingItemMin', () => {
    const baseProps = {
        title: 'Test Title',
        isDisabled: false,
        section: 'test-section',
        updateSection: jest.fn(),
        describe: 'Test description',
    };

    test('should render with default props', () => {
        renderWithContext(<SettingItemMin {...baseProps}/>);

        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Test description')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Test Title Edit'})).toBeInTheDocument();
    });

    test('should render without edit button when disabled', () => {
        const props = {...baseProps, isDisabled: true};
        renderWithContext(<SettingItemMin {...props}/>);

        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Test description')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    test('should render custom disabled edit button when provided', () => {
        const customEditButton = <span>{'Custom Edit Button'}</span>;
        const props = {
            ...baseProps,
            isDisabled: true,
            collapsedEditButtonWhenDisabled: customEditButton,
        };
        renderWithContext(<SettingItemMin {...props}/>);

        expect(screen.getByText('Custom Edit Button')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    test('should call updateSection when edit button is clicked', async () => {
        const updateSection = jest.fn();
        const props = {...baseProps, updateSection};
        renderWithContext(<SettingItemMin {...props}/>);

        const editButton = screen.getByRole('button', {name: 'Test Title Edit'});
        await userEvent.click(editButton);

        expect(updateSection).toHaveBeenCalledTimes(1);
        expect(updateSection).toHaveBeenCalledWith('test-section');
    });

    test('should call updateSection when container div is clicked', async () => {
        const updateSection = jest.fn();
        const props = {...baseProps, updateSection};
        renderWithContext(<SettingItemMin {...props}/>);

        const container = screen.getByText('Test Title').closest('.section-min');
        await userEvent.click(container!);

        expect(updateSection).toHaveBeenCalledTimes(1);
        expect(updateSection).toHaveBeenCalledWith('test-section');
    });

    test('should not call updateSection when disabled and edit button area is clicked', async () => {
        const updateSection = jest.fn();
        const props = {...baseProps, updateSection, isDisabled: true};
        renderWithContext(<SettingItemMin {...props}/>);

        const container = screen.getByText('Test Title').closest('.section-min');
        await userEvent.click(container!);

        expect(updateSection).not.toHaveBeenCalled();
    });

    test('should have correct accessibility attributes', () => {
        renderWithContext(<SettingItemMin {...baseProps}/>);

        const editButton = screen.getByRole('button', {name: 'Test Title Edit'});
        expect(editButton).toHaveAttribute('aria-expanded', 'false');
        expect(editButton).toHaveAttribute('id', 'test-sectionEdit');
        expect(editButton).toHaveAttribute('aria-labelledby', 'test-sectionTitle test-sectionEdit');

        const title = screen.getByText('Test Title');
        expect(title).toHaveAttribute('id', 'test-sectionTitle');

        const description = screen.getByText('Test description');
        expect(description).toHaveAttribute('id', 'test-sectionDesc');
    });

    test('should apply disabled styling when isDisabled is true', () => {
        const props = {...baseProps, isDisabled: true};
        renderWithContext(<SettingItemMin {...props}/>);

        const container = screen.getByText('Test Title').closest('.section-min');
        const title = screen.getByText('Test Title');
        const description = screen.getByText('Test description');

        expect(container).toHaveClass('isDisabled');
        expect(title).toHaveClass('isDisabled');
        expect(description).toHaveClass('isDisabled');
    });
});
