// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {InputActionMeta} from 'react-select';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext} from 'tests/react_testing_utils';

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
        it('should split pasted values on spaces', async () => {
            const ref = React.createRef<UsersEmailsInput>();
            renderWithContext(
                <UsersEmailsInput
                    {...baseProps}
                    ref={ref}
                />,
            );

            const count = await ref.current!.appendDelimitedValues('user1@example.com user2@example.com');

            expect(count).toBe(2);
            expect(baseProps.onChange).toHaveBeenCalled();
            const changeArgs = baseProps.onChange.mock.calls[0][0];
            expect(changeArgs).toHaveLength(2);
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
    });
});
