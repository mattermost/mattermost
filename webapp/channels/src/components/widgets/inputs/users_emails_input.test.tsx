// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {InputActionMeta} from 'react-select';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {fireEvent, renderWithContext, userEvent, waitFor, screen} from 'tests/react_testing_utils';

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

        it('should not create a chip while typing a valid email without delimiters', async () => {
            const ref = React.createRef<UsersEmailsInput>();
            renderWithContext(
                <UsersEmailsInput
                    {...baseProps}
                    ref={ref}
                />,
            );

            const action: InputActionMeta = {
                action: 'input-change',
                prevInputValue: 'person.one@example.co',
            };

            await ref.current!.handleInputChange('person.one@example.com', action);

            expect(baseProps.onChange).not.toHaveBeenCalled();
            expect(baseProps.onInputChange).toHaveBeenCalledWith('person.one@example.com');
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

        it('should convert a pasted single valid email into a chip', async () => {
            jest.spyOn(Client4, 'getUserByEmail').mockRejectedValue(new Error('not found'));

            const user = userEvent.setup();
            const {onChange} = renderControlledInput();

            const input = screen.getByRole('combobox');
            await user.click(input);
            fireEvent.paste(input, {
                clipboardData: {
                    getData: (type: string) => {
                        if (type === 'Text') {
                            return 'person@example.com';
                        }
                        return '';
                    },
                },
            });

            await waitFor(() => {
                expect(onChange).toHaveBeenCalledWith(['person@example.com']);
            });

            expect(input).toHaveValue('');
        });

        it('should keep arbitrary pasted text as draft input and show the no-match message', async () => {
            const user = userEvent.setup();
            const {onChange, onInputChange, usersLoader} = renderControlledInput();

            const input = screen.getByRole('combobox');
            await user.click(input);
            await user.paste('nonsense');

            await waitFor(() => {
                expect(onInputChange).toHaveBeenCalledWith('nonsense');
            });

            expect(onChange).not.toHaveBeenCalledWith(expect.arrayContaining(['nonsense']));
            expect(input).toHaveValue('nonsense');
            expect(usersLoader).toHaveBeenCalledWith('nonsense', expect.any(Function));
            await waitFor(() => {
                expect(document.querySelector('.users-emails-input__menu-notice')).toHaveTextContent('No one found matching nonsense. Enter their email to invite them.');
            });
        });

        it('should split pasted values on spaces when all tokens are valid emails', async () => {
            jest.spyOn(Client4, 'getUserByEmail').mockRejectedValue(new Error('not found'));

            const user = userEvent.setup();
            const {onChange} = renderControlledInput();

            const input = screen.getByRole('combobox');
            await user.click(input);
            fireEvent.paste(input, {
                clipboardData: {
                    getData: (type: string) => {
                        if (type === 'Text') {
                            return 'first@example.com second@example.com';
                        }
                        return '';
                    },
                },
            });

            await waitFor(() => {
                expect(onChange).toHaveBeenCalledWith(['first@example.com', 'second@example.com']);
            });

            const changeArgs = onChange.mock.calls[0][0];
            expect(changeArgs).toHaveLength(2);
            expect(input).toHaveValue('');
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
                'first@example.com second@example.com',
                /\s+/,
                /\s+/,
            );

            expect(count).toBe(2);
            expect(baseProps.onChange).toHaveBeenCalledWith(['first@example.com', 'second@example.com']);
            const changeArgs = baseProps.onChange.mock.calls[0][0];
            expect(changeArgs).toHaveLength(2);
            expect(baseProps.onInputChange).toHaveBeenCalledWith('');
        });

        it('should keep mixed space-delimited paste as draft text', async () => {
            jest.spyOn(Client4, 'getUserByEmail').mockRejectedValue(new Error('not found'));

            const user = userEvent.setup();
            const {onChange, onInputChange} = renderControlledInput();

            const input = screen.getByRole('combobox');
            await user.click(input);
            await user.paste('first@example.com word second@example.com');

            await waitFor(() => {
                expect(onInputChange).toHaveBeenCalledWith('first@example.com word second@example.com');
            });

            expect(onChange).not.toHaveBeenCalledWith(expect.arrayContaining(['first@example.com', 'second@example.com']));
            expect(input).toHaveValue('first@example.com word second@example.com');
        });

        it('should preserve space-separated draft text on blur when it is not a valid single email', async () => {
            const user = userEvent.setup();
            const {onInputChange} = renderControlledInput();

            const input = screen.getByRole('combobox');
            await user.click(input);
            await user.type(input, 'first@example.com second@example.com');
            fireEvent.blur(input);

            expect(input).toHaveValue('first@example.com second@example.com');
            expect(onInputChange).toHaveBeenLastCalledWith('first@example.com second@example.com');
        });
    });
});
