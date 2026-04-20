// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

import CustomURLSchemesSetting from './custom_url_schemes_setting';

describe('components/AdminConsole/CustomUrlSchemeSetting', () => {
    const baseProps = {
        id: 'MySetting',
        value: ['git', 'smtp'],
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
                <CustomURLSchemesSetting {...props}/>,
            );
            expect(container).toMatchSnapshot();

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            expect(input.value).toEqual('');
        });

        test('with one item', () => {
            const props = {
                ...baseProps,
                value: ['git'],
            };

            const {container} = renderWithContext(
                <CustomURLSchemesSetting {...props}/>,
            );
            expect(container).toMatchSnapshot();

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            expect(input.value).toEqual('git');
        });

        test('with multiple items', () => {
            const props = {
                ...baseProps,
                value: ['git', 'smtp', 'steam'],
            };

            const {container} = renderWithContext(
                <CustomURLSchemesSetting {...props}/>,
            );
            expect(container).toMatchSnapshot();

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            expect(input.value).toEqual('git,smtp,steam');
        });
    });

    describe('onChange', () => {
        test('called on change to empty', async () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const {container} = renderWithContext(
                <CustomURLSchemesSetting {...props}/>,
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
                <CustomURLSchemesSetting {...props}/>,
            );

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            await userEvent.clear(input);
            await userEvent.type(input, '  steam  ');

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['steam']);
        });

        test('called on change to two items', async () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const {container} = renderWithContext(
                <CustomURLSchemesSetting {...props}/>,
            );

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            await userEvent.clear(input);
            await userEvent.type(input, 'steam, git');

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['steam', 'git']);
        });

        test('called on change to more items', async () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const {container} = renderWithContext(
                <CustomURLSchemesSetting {...props}/>,
            );

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            await userEvent.clear(input);
            await userEvent.type(input, 'ts3server, smtp, ms-excel');

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['ts3server', 'smtp', 'ms-excel']);
        });

        test('called on change with extra commas', async () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const {container} = renderWithContext(
                <CustomURLSchemesSetting {...props}/>,
            );

            const input = container.querySelector('#MySetting') as HTMLInputElement;
            await userEvent.clear(input);
            await userEvent.type(input, ',,,,,chrome,,,,ms-excel,,');

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['chrome', 'ms-excel']);
        });
    });

    test('renders properly when disabled', () => {
        const props = {
            ...baseProps,
            disabled: true,
        };

        const {container} = renderWithContext(
            <CustomURLSchemesSetting {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('renders properly when set by environment variable', () => {
        const props = {
            ...baseProps,
            setByEnv: true,
        };

        const {container} = renderWithContext(
            <CustomURLSchemesSetting {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });
});
