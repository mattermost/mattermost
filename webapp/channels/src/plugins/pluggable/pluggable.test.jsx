// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import Pluggable from './pluggable';

class ProfilePopoverPlugin extends React.PureComponent {
    render() {
        return <span id='pluginId'>{'ProfilePopoverPlugin'}</span>;
    }
}

jest.mock('actions/views/profile_popover');

describe('plugins/Pluggable', () => {
    const baseProps = {
        pluggableName: '',
        components: {},
        theme: {},
    };

    test('should match snapshot with no extended component', () => {
        const wrapper = mountWithIntl(
            <Pluggable
                {...baseProps}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with extended component', () => {
        const wrapper = mountWithIntl(
            <Pluggable
                {...baseProps}
                pluggableName='PopoverSection1'
                components={{PopoverSection1: [{component: ProfilePopoverPlugin}]}}
            />,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('#pluginId').text()).toBe('ProfilePopoverPlugin');
        expect(wrapper.find(ProfilePopoverPlugin).exists()).toBe(true);
    });

    test('should match snapshot with extended component with pluggableName', () => {
        const wrapper = mountWithIntl(
            <Pluggable
                {...baseProps}
                pluggableName='PopoverSection1'
                components={{PopoverSection1: [{component: ProfilePopoverPlugin}]}}
            />,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('#pluginId').text()).toBe('ProfilePopoverPlugin');
        expect(wrapper.find(ProfilePopoverPlugin).exists()).toBe(true);
    });

    test('should return null if neither pluggableName nor children is is defined in props', () => {
        const wrapper = mountWithIntl(
            <Pluggable
                {...baseProps}
                components={{PopoverSection1: [{component: ProfilePopoverPlugin}]}}
            />,
        );

        expect(wrapper.find(ProfilePopoverPlugin).exists()).toBe(false);
    });

    test('should return null if with pluggableName but no children', () => {
        const wrapper = mountWithIntl(
            <Pluggable
                {...baseProps}
                pluggableName='PopoverSection1'
            />,
        );

        expect(wrapper.children().length).toBe(0);
    });

    test('should match snapshot with non-null pluggableId', () => {
        const wrapper = mountWithIntl(
            <Pluggable
                pluggableName='PopoverSection1'
                pluggableId={'pluggableId'}
                components={{PopoverSection1: [{component: ProfilePopoverPlugin}]}}
            />,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(ProfilePopoverPlugin).exists()).toBe(false);
    });

    test('should match snapshot with null pluggableId', () => {
        const wrapper = mountWithIntl(
            <Pluggable
                {...baseProps}
                pluggableName='PopoverSection1'
                components={{PopoverSection1: [{component: ProfilePopoverPlugin}]}}
            />,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(ProfilePopoverPlugin).exists()).toBe(true);
    });

    test('should match snapshot with valid pluggableId', () => {
        const wrapper = mountWithIntl(
            <Pluggable
                {...baseProps}
                pluggableName='PopoverSection1'
                pluggableId={'pluggableId'}
                components={{PopoverSection1: [{id: 'pluggableId', component: ProfilePopoverPlugin}]}}
            />,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(ProfilePopoverPlugin).exists()).toBe(true);
    });
});
