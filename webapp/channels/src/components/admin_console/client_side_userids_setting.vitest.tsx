// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntl, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import ClientSideUserIdsSetting from './client_side_userids_setting';

describe('components/AdminConsole/ClientSideUserIdsSetting', () => {
    const baseProps = {
        id: 'MySetting',
        value: ['userid1', 'userid2'],
        onChange: vi.fn(),
        disabled: false,
        setByEnv: false,
    };

    describe('initial state', () => {
        test('with no items', () => {
            const props = {
                ...baseProps,
                value: [],
            };

            const {container} = renderWithIntl(
                <ClientSideUserIdsSetting {...props}/>,
            );
            expect(container).toMatchSnapshot();

            // Instead of checking wrapper.state('value'), check the input value
            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.value).toEqual('');
        });

        test('with one item', () => {
            const props = {
                ...baseProps,
                value: ['userid1'],
            };

            const {container} = renderWithIntl(
                <ClientSideUserIdsSetting {...props}/>,
            );
            expect(container).toMatchSnapshot();

            // Instead of checking wrapper.state('value'), check the input value
            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.value).toEqual('userid1');
        });

        test('with multiple items', () => {
            const props = {
                ...baseProps,
                value: ['userid1', 'userid2', 'id3'],
            };

            const {container} = renderWithIntl(
                <ClientSideUserIdsSetting {...props}/>,
            );
            expect(container).toMatchSnapshot();

            // Instead of checking wrapper.state('value'), check the input value
            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.value).toEqual('userid1,userid2,id3');
        });
    });

    describe('onChange', () => {
        test('called on change to empty', () => {
            const props = {
                ...baseProps,
                onChange: vi.fn(),
            };

            renderWithIntl(
                <ClientSideUserIdsSetting {...props}/>,
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, {target: {value: ''}});

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, []);
        });

        test('called on change to one item', () => {
            const props = {
                ...baseProps,
                onChange: vi.fn(),
            };

            renderWithIntl(
                <ClientSideUserIdsSetting {...props}/>,
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, {target: {value: '  id2  '}});

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['id2']);
        });

        test('called on change to two items', () => {
            const props = {
                ...baseProps,
                onChange: vi.fn(),
            };

            renderWithIntl(
                <ClientSideUserIdsSetting {...props}/>,
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, {target: {value: 'id1, id99'}});

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['id1', 'id99']);
        });
    });

    test('renders properly when disabled', () => {
        const props = {
            ...baseProps,
            disabled: true,
        };

        const {container} = renderWithIntl(
            <ClientSideUserIdsSetting {...props}/>,
        );
        expect(container).toMatchSnapshot();

        // Verify input is disabled
        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
    });

    test('renders properly when set by environment variable', () => {
        const props = {
            ...baseProps,
            setByEnv: true,
        };

        const {container} = renderWithIntl(
            <ClientSideUserIdsSetting {...props}/>,
        );
        expect(container).toMatchSnapshot();

        // Verify input is disabled when set by env
        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
    });
});
