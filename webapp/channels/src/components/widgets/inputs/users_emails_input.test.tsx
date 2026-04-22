// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {InputActionMeta} from 'react-select';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, userEvent, waitFor, screen} from 'tests/react_testing_utils';

import {UsersEmailsInput} from './users_emails_input';

describe('components/widgets/inputs/UsersEmailsInput', () => {
    const baseProps = {
        intl: defaultIntl,
        placeholder: 'Search and add people',
        ariaLabel: 'Search and add people',
        usersLoader: jest.fn().mockReturnValue(Promise.resolve([])),
        onChange: jest.fn(),
        onInputChange: jest.fn(),
        inputValue: '',
        value: [],
        emailInvitationsEnabled: true,
    };

    function renderControlledInput({
        usersLoader = jest.fn().mockImplementation((_search: string, callback: (users: UserProfile[]) => void) => {
            callback([]);
            return Promise.resolve([]);
        }),
        onChange = jest.fn(),
        onInputChange = jest.fn(),
    }: {
        usersLoader?: (search: string, callback: (users: UserProfile[]) => void) => Promise<UserProfile[]>;
        onChange?: jest.Mock;
        onInputChange?: jest.Mock;
    } = {}) {
        const Wrapper = () => {
            const [inputValue, setInputValue] = React.useState('');
            const [value, setValue] = React.useState<Array<UserProfile | string>>([]);

            return (
                <UsersEmailsInput
                    {...baseProps}
                    usersLoader={usersLoader}
                    onChange={(nextValue) => {
                        onChange(nextValue);
                        setValue(nextValue);
                    }}
                    onInputChange={(nextInputValue) => {
                        onInputChange(nextInputValue);
                        setInputValue(nextInputValue);
                    }}
                    inputValue={inputValue}
                    value={value}
                />
            );
        };

        return {
            ...renderWithContext(<Wrapper/>),
            usersLoader,
            onChange,
            onInputChange,
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('delimiter handling on typed input', () => {
        it('should NOT treat space as a delimiter when typing', async () => {
            const ref = React.createRef<UsersEmailsInput>();
            renderWithContext(
                <UsersEmailsInput
                    {...baseProps}
                    ref={ref}
                />,
            );

            const action: InputActionMeta = {
                action: 'input-change',
                prevInputValue: 'john ',
            };

            await ref.current!.handleInputChange('john s', action);

            expect(baseProps.onInputChange).toHaveBeenCalledWith('john s');
        });

        it('should treat comma as a delimiter when typing', async () => {
            const ref = React.createRef<UsersEmailsInput>();
            renderWithContext(
                <UsersEmailsInput
                    {...baseProps}
                    ref={ref}
                />,
            );

            const action: InputActionMeta = {
                action: 'input-change',
                prevInputValue: 'user@example.com,',
            };

            await ref.current!.handleInputChange('', action);

            expect(baseProps.onChange).toHaveBeenCalled();
        });

        it('should treat semicolon as a delimiter when typing', async () => {
            const ref = React.createRef<UsersEmailsInput>();
            renderWithContext(
                <UsersEmailsInput
                    {...baseProps}
                    ref={ref}
                />,
            );

            const action: InputActionMeta = {
                action: 'input-change',
                prevInputValue: 'user@example.com;',
            };

            await ref.current!.handleInputChange('', action);

            expect(baseProps.onChange).toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('should handle comma-then-space pattern without losing email', async () => {
            const ref = React.createRef<UsersEmailsInput>();
            renderWithContext(
                <UsersEmailsInput
                    {...baseProps}
                    ref={ref}
                />,
            );

            const count = await ref.current!.appendDelimitedValues('user@example.com, ', /[,;]+/);

            expect(count).toBe(1);
            expect(baseProps.onChange).toHaveBeenCalled();
        });
    });

    describe('delimiter handling on paste', () => {
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should split pasted values on newlines', async () => {
            const ref = React.createRef<UsersEmailsInput>();
            renderWithContext(
                <UsersEmailsInput
                    {...baseProps}
                    ref={ref}
                />,
            );

            const count = await ref.current!.appendDelimitedValues('user1@example.com\nuser2@example.com');

            expect(count).toBe(2);
            expect(baseProps.onChange).toHaveBeenCalled();
        });

        it('should split pasted values on commas', async () => {
            const ref = React.createRef<UsersEmailsInput>();
            renderWithContext(
                <UsersEmailsInput
                    {...baseProps}
                    ref={ref}
                />,
            );

            const count = await ref.current!.appendDelimitedValues('user1@example.com,user2@example.com');

            expect(count).toBe(2);
            expect(baseProps.onChange).toHaveBeenCalled();
        });

        it('should bulk-commit obvious list pastes', async () => {
            jest.spyOn(Client4, 'getUserByEmail').mockRejectedValue(new Error('not found'));

            const user = userEvent.setup();
            const {onChange} = renderControlledInput();

            const input = screen.getByRole('combobox');
            await user.click(input);
            await user.paste('user1@example.com,user2@example.com');

            await waitFor(() => {
                expect(onChange).toHaveBeenCalledWith(['user1@example.com', 'user2@example.com']);
            });

            expect(input).toHaveValue('');
        });

        it('should keep arbitrary pasted text as draft input and show the no-match message', async () => {
            const user = userEvent.setup();
            const {onChange, onInputChange, usersLoader} = renderControlledInput();

            const input = screen.getByRole('combobox');
            await user.click(input);
            await user.paste('fgdfg');

            await waitFor(() => {
                expect(onInputChange).toHaveBeenCalledWith('fgdfg');
            });

            expect(onChange).not.toHaveBeenCalled();
            expect(input).toHaveValue('fgdfg');
            expect(usersLoader).toHaveBeenCalledWith('fgdfg', expect.any(Function));
            await waitFor(() => {
                expect(document.querySelector('.users-emails-input__menu-notice')).toHaveTextContent('No one found matching fgdfg. Enter their email to invite them.');
            });
        });

        it('should bulk-commit space-delimited valid email pastes', async () => {
            jest.spyOn(Client4, 'getUserByEmail').mockRejectedValue(new Error('not found'));

            const ref = React.createRef<UsersEmailsInput>();
            renderWithContext(
                <UsersEmailsInput
                    {...baseProps}
                    ref={ref}
                />,
            );

            const count = await ref.current!.appendDelimitedValues(
                'Maria@mattermost.com nick@mattermost.com',
                /\s+/,
                /\s+/,
            );

            expect(count).toBe(2);
            expect(baseProps.onChange).toHaveBeenCalledWith(['Maria@mattermost.com', 'nick@mattermost.com']);
            expect(baseProps.onInputChange).toHaveBeenCalledWith('');
        });

        it('should keep mixed space-delimited paste as draft text', async () => {
            jest.spyOn(Client4, 'getUserByEmail').mockRejectedValue(new Error('not found'));

            const user = userEvent.setup();
            const {onChange, onInputChange} = renderControlledInput();

            const input = screen.getByRole('combobox');
            await user.click(input);
            await user.paste('Maria@mattermost.com nick bad@mattermost.com');

            await waitFor(() => {
                expect(onInputChange).toHaveBeenCalledWith('Maria@mattermost.com nick bad@mattermost.com');
            });

            expect(onChange).not.toHaveBeenCalled();
            expect(input).toHaveValue('Maria@mattermost.com nick bad@mattermost.com');
        });
    });
});
