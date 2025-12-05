// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntl, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import CustomURLSchemesSetting from './custom_url_schemes_setting';

describe('components/AdminConsole/CustomUrlSchemeSetting', () => {
    const baseProps = {
        id: 'MySetting',
        value: ['git', 'smtp'],
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
                <CustomURLSchemesSetting {...props}/>,
            );
            expect(container).toMatchSnapshot();

            // Instead of checking wrapper.state('value'), check the input value
            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.value).toEqual('');
        });

        test('with one item', () => {
            const props = {
                ...baseProps,
                value: ['git'],
            };

            const {container} = renderWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );
            expect(container).toMatchSnapshot();

            // Instead of checking wrapper.state('value'), check the input value
            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.value).toEqual('git');
        });

        test('with multiple items', () => {
            const props = {
                ...baseProps,
                value: ['git', 'smtp', 'steam'],
            };

            const {container} = renderWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );
            expect(container).toMatchSnapshot();

            // Instead of checking wrapper.state('value'), check the input value
            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.value).toEqual('git,smtp,steam');
        });
    });

    describe('onChange', () => {
        test('called on change to empty', () => {
            const props = {
                ...baseProps,
                onChange: vi.fn(),
            };

            renderWithIntl(
                <CustomURLSchemesSetting {...props}/>,
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
                <CustomURLSchemesSetting {...props}/>,
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, {target: {value: '  steam  '}});

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['steam']);
        });

        test('called on change to two items', () => {
            const props = {
                ...baseProps,
                onChange: vi.fn(),
            };

            renderWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, {target: {value: 'steam, git'}});

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['steam', 'git']);
        });

        test('called on change to more items', () => {
            const props = {
                ...baseProps,
                onChange: vi.fn(),
            };

            renderWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, {target: {value: 'ts3server, smtp, ms-excel'}});

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['ts3server', 'smtp', 'ms-excel']);
        });

        test('called on change with extra commas', () => {
            const props = {
                ...baseProps,
                onChange: vi.fn(),
            };

            renderWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, {target: {value: ',,,,,chrome,,,,ms-excel,,'}});

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['chrome', 'ms-excel']);
        });
    });

    test('renders properly when disabled', () => {
        const props = {
            ...baseProps,
            disabled: true,
        };

        const {container} = renderWithIntl(
            <CustomURLSchemesSetting {...props}/>,
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
            <CustomURLSchemesSetting {...props}/>,
        );
        expect(container).toMatchSnapshot();

        // Verify input is disabled when set by env
        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
    });
});
