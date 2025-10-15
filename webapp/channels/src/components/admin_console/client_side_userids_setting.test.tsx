// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

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

            const wrapper = mountWithIntl(
                <ClientSideUserIdsSetting {...props}/>,
            );
            expect(wrapper).toMatchSnapshot();

            expect(wrapper.state('value')).toEqual('');
        });

        test('with one item', () => {
            const props = {
                ...baseProps,
                value: ['userid1'],
            };

            const wrapper = mountWithIntl(
                <ClientSideUserIdsSetting {...props}/>,
            );
            expect(wrapper).toMatchSnapshot();

            expect(wrapper.state('value')).toEqual('userid1');
        });

        test('with multiple items', () => {
            const props = {
                ...baseProps,
                value: ['userid1', 'userid2', 'id3'],
            };

            const wrapper = mountWithIntl(
                <ClientSideUserIdsSetting {...props}/>,
            );
            expect(wrapper).toMatchSnapshot();

            expect(wrapper.state('value')).toEqual('userid1,userid2,id3');
        });
    });

    describe('onChange', () => {
        test('called on change to empty', () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const wrapper = mountWithIntl(
                <ClientSideUserIdsSetting {...props}/>,
            );

            wrapper.find('input').simulate('change', {target: {value: ''}});

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, []);
        });

        test('called on change to one item', () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const wrapper = mountWithIntl(
                <ClientSideUserIdsSetting {...props}/>,
            );

            wrapper.find('input').simulate('change', {target: {value: '  id2  '}});

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['id2']);
        });

        test('called on change to two items', () => {
            const props = {
                ...baseProps,
                onChange: jest.fn(),
            };

            const wrapper = mountWithIntl(
                <ClientSideUserIdsSetting {...props}/>,
            );

            wrapper.find('input').simulate('change', {target: {value: 'id1, id99'}});

            expect(props.onChange).toHaveBeenCalledWith(baseProps.id, ['id1', 'id99']);
        });
    });

    test('renders properly when disabled', () => {
        const props = {
            ...baseProps,
            disabled: true,
        };

        const wrapper = mountWithIntl(
            <ClientSideUserIdsSetting {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('renders properly when set by environment variable', () => {
        const props = {
            ...baseProps,
            setByEnv: true,
        };

        const wrapper = mountWithIntl(
            <ClientSideUserIdsSetting {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
