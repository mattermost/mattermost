// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

import ClientSideUserIdsSetting from './client_side_userids_setting';

describe('components/AdminConsole/ClientSideUserIdsSetting', () => {
    const baseProps = {
        id: 'MySetting',
        value: ['userid1', 'userid2'],
        onChange: jest.fn(),
        disabled: false,
        setByEnv: false,
    };

    describe('initial state', () => {
        test('with no items', () => {
            const props = {
                ...baseProps,
                value: [],
            };

            const {container} = renderWithContext(
                <ClientSideUserIdsSetting {...props}/>,
            );
            expect(container).toMatchSnapshot();

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            expect(input.value).toEqual('');
        });

        test('with one item', () => {
            const props = {
                ...baseProps,
                value: ['userid1'],
            };

            const {container} = renderWithContext(
                <ClientSideUserIdsSetting {...props}/>,
            );
            expect(container).toMatchSnapshot();

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            expect(input.value).toEqual('userid1');
        });

        test('with multiple items', () => {
            const props = {
                ...baseProps,
                value: ['userid1', 'userid2', 'id3'],
            };

            const {container} = renderWithContext(
                <ClientSideUserIdsSetting {...props}/>,
            );
            expect(container).toMatchSnapshot();

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            expect(input.value).toEqual('userid1,userid2,id3');
        });
    });

    describe('onChange', () => {
        test('called on change to empty', async () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const {container} = renderWithContext(
                <ClientSideUserIdsSetting {...props}/>,
            );

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            await userEvent.clear(input);

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, []);
        });

        test('called on change to one item', async () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const {container} = renderWithContext(
                <ClientSideUserIdsSetting {...props}/>,
            );

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            await userEvent.clear(input);
            await userEvent.type(input, '  id2  ');

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['id2']);
        });

        test('called on change to two items', async () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const {container} = renderWithContext(
                <ClientSideUserIdsSetting {...props}/>,
            );

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            await userEvent.clear(input);
            await userEvent.type(input, 'id1, id99');

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['id1', 'id99']);
        });
    });

    test('renders properly when disabled', () => {
        const props = {
            ...baseProps,
            disabled: true,
        };

        const {container} = renderWithContext(
            <ClientSideUserIdsSetting {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('renders properly when set by environment variable', () => {
        const props = {
            ...baseProps,
            setByEnv: true,
        };

        const {container} = renderWithContext(
            <ClientSideUserIdsSetting {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });
});
