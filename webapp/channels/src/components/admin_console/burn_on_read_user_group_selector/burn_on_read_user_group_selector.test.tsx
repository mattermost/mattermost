// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import BurnOnReadUserGroupSelector from './burn_on_read_user_group_selector';

// Mock the UserSelector component from content_flagging
jest.mock('../content_flagging/user_multiselector/user_multiselector', () => ({
    UserSelector: ({id, isMulti, multiSelectInitialValue, multiSelectOnChange, placeholder, enableGroups, enableTeams, disabled}: any) => {
        const handleClick = () => {
            // Simulate UserSelector onChange with array of IDs
            if (multiSelectOnChange && !disabled) {
                multiSelectOnChange(['user1', 'user2']);
            }
        };

        return (
            <div data-testid='user-selector'>
                <input
                    data-testid={id}
                    data-is-multi={String(isMulti)}
                    data-initial-value={JSON.stringify(multiSelectInitialValue)}
                    data-enable-groups={String(enableGroups)}
                    data-enable-teams={String(enableTeams)}
                    data-disabled={String(disabled)}
                    placeholder={placeholder}
                    disabled={Boolean(disabled)}
                    onClick={handleClick}
                    readOnly={true}
                />
            </div>
        );
    },
}));

describe('components/admin_console/burn_on_read_user_group_selector/BurnOnReadUserGroupSelector', () => {
    const baseProps = {
        id: 'ServiceSettings.BurnOnReadAllowedUsersList',
        label: 'Selected Users and Groups',
        helpText: 'Choose specific users or groups...',
        value: '',
        onChange: jest.fn(),
        disabled: false,
        setByEnv: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render with basic props', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector {...baseProps}/>,
        );

        expect(screen.getByText('Selected Users and Groups')).toBeInTheDocument();
        expect(screen.getByText('Choose specific users or groups...')).toBeInTheDocument();
        expect(screen.getByTestId('user-selector')).toBeInTheDocument();
    });

    test('should pass enableGroups=true to UserSelector', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector {...baseProps}/>,
        );

        const inputs = screen.getAllByTestId(baseProps.id);
        const input = inputs[inputs.length - 1]; // Get the input element (last one)
        expect(input.getAttribute('data-enable-groups')).toBe('true');
    });

    test('should parse comma-separated string value into array', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector
                {...baseProps}
                value='user1,user2,group1'
            />,
        );

        const inputs = screen.getAllByTestId(baseProps.id);
        const input = inputs[inputs.length - 1];
        const initialValue = JSON.parse(input.getAttribute('data-initial-value') || '[]');
        expect(initialValue).toEqual(['user1', 'user2', 'group1']);
    });

    test('should handle array value directly', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector
                {...baseProps}
                value={['user1', 'user2']}
            />,
        );

        const inputs = screen.getAllByTestId(baseProps.id);
        const input = inputs[inputs.length - 1];
        const initialValue = JSON.parse(input.getAttribute('data-initial-value') || '[]');
        expect(initialValue).toEqual(['user1', 'user2']);
    });

    test('should handle empty string value', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector
                {...baseProps}
                value=''
            />,
        );

        const inputs = screen.getAllByTestId(baseProps.id);
        const input = inputs[inputs.length - 1];
        const initialValue = JSON.parse(input.getAttribute('data-initial-value') || '[]');
        expect(initialValue).toEqual([]);
    });

    test('should handle undefined value', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector
                {...baseProps}
                value={undefined}
            />,
        );

        const inputs = screen.getAllByTestId(baseProps.id);
        const input = inputs[inputs.length - 1];
        const initialValue = JSON.parse(input.getAttribute('data-initial-value') || '[]');
        expect(initialValue).toEqual([]);
    });

    test('should filter out empty strings when parsing comma-separated value', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector
                {...baseProps}
                value='user1,,user2,'
            />,
        );

        const inputs = screen.getAllByTestId(baseProps.id);
        const input = inputs[inputs.length - 1];
        const initialValue = JSON.parse(input.getAttribute('data-initial-value') || '[]');
        expect(initialValue).toEqual(['user1', 'user2']);
    });

    test('should convert array onChange callback to comma-separated string', () => {
        const onChange = jest.fn();

        renderWithContext(
            <BurnOnReadUserGroupSelector
                {...baseProps}
                onChange={onChange}
            />,
        );

        const inputs = screen.getAllByTestId(baseProps.id);
        const input = inputs[inputs.length - 1] as HTMLInputElement;
        input.click(); // Trigger the mock's onClick handler

        expect(onChange).toHaveBeenCalledWith(baseProps.id, 'user1,user2');
    });

    test('should pass disabled prop to UserSelector', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector
                {...baseProps}
                disabled={true}
            />,
        );

        const inputs = screen.getAllByTestId(baseProps.id);
        const input = inputs[inputs.length - 1];
        expect(input.getAttribute('data-disabled')).toBe('true');
        expect(input).toBeDisabled();
    });

    test('should pass setByEnv to Setting component', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector
                {...baseProps}
                setByEnv={true}
            />,
        );

        // Setting component should render with setByEnv indicator
        expect(screen.getByText('Selected Users and Groups')).toBeInTheDocument();
    });

    test('should use correct placeholder text', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector {...baseProps}/>,
        );

        expect(screen.getByPlaceholderText('Start typing to search for users, groups, and teams...')).toBeInTheDocument();
    });

    test('should pass isMulti=true to UserSelector', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector {...baseProps}/>,
        );

        const inputs = screen.getAllByTestId(baseProps.id);
        const input = inputs[inputs.length - 1];
        expect(input.getAttribute('data-is-multi')).toBe('true');
    });

    // Team support tests
    test('should enable teams in UserSelector', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector {...baseProps}/>,
        );

        const inputs = screen.getAllByTestId(baseProps.id);
        const input = inputs[inputs.length - 1];
        expect(input.getAttribute('data-enable-teams')).toBe('true');
    });

    test('should have placeholder mentioning teams', () => {
        renderWithContext(
            <BurnOnReadUserGroupSelector {...baseProps}/>,
        );

        const inputs = screen.getAllByTestId(baseProps.id);
        const input = inputs[inputs.length - 1] as HTMLInputElement;
        expect(input.placeholder).toContain('teams');
    });
});
