// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

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

            const wrapper = mountWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );
            expect(wrapper).toMatchSnapshot();

            expect(wrapper.state('value')).toEqual('');
        });

        test('with one item', () => {
            const props = {
                ...baseProps,
                value: ['git'],
            };

            const wrapper = mountWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );
            expect(wrapper).toMatchSnapshot();

            expect(wrapper.state('value')).toEqual('git');
        });

        test('with multiple items', () => {
            const props = {
                ...baseProps,
                value: ['git', 'smtp', 'steam'],
            };

            const wrapper = mountWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );
            expect(wrapper).toMatchSnapshot();

            expect(wrapper.state('value')).toEqual('git,smtp,steam');
        });
    });

    describe('onChange', () => {
        test('called on change to empty', () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const wrapper = mountWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );

            wrapper.find('input').simulate('change', {target: {value: ''}});

            expect(props.onChange).toBeCalledWith(baseProps.id, []);
        });

        test('called on change to one item', () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const wrapper = mountWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );

            wrapper.find('input').simulate('change', {target: {value: '  steam  '}});

            expect(props.onChange).toBeCalledWith(baseProps.id, ['steam']);
        });

        test('called on change to two items', () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const wrapper = mountWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );

            wrapper.find('input').simulate('change', {target: {value: 'steam, git'}});

            expect(props.onChange).toBeCalledWith(baseProps.id, ['steam', 'git']);
        });

        test('called on change to more items', () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const wrapper = mountWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );

            wrapper.find('input').simulate('change', {target: {value: 'ts3server, smtp, ms-excel'}});

            expect(props.onChange).toBeCalledWith(baseProps.id, ['ts3server', 'smtp', 'ms-excel']);
        });

        test('called on change with extra commas', () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const wrapper = mountWithIntl(
                <CustomURLSchemesSetting {...props}/>,
            );

            wrapper.find('input').simulate('change', {target: {value: ',,,,,chrome,,,,ms-excel,,'}});

            expect(props.onChange).toBeCalledWith(baseProps.id, ['chrome', 'ms-excel']);
        });
    });

    test('renders properly when disabled', () => {
        const props = {
            ...baseProps,
            disabled: true,
        };

        const wrapper = mountWithIntl(
            <CustomURLSchemesSetting {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('renders properly when set by environment variable', () => {
        const props = {
            ...baseProps,
            setByEnv: true,
        };

        const wrapper = mountWithIntl(
            <CustomURLSchemesSetting {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
