// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mount} from 'enzyme';

import SemanticTime from './semantic_time';

describe('components/timestamp/SemanticTime', () => {
    test('should render time semantically', () => {
        const date = new Date('2020-06-05T10:20:30Z');
        const wrapper = mount(
            <SemanticTime
                value={date}
            />,
        );
        expect(wrapper.find('time').prop('dateTime')).toBe('2020-06-05T10:20:30.000');
    });

    test('should support passthrough children', () => {
        const date = new Date('2020-06-05T10:20:30Z');
        const wrapper = mount(
            <SemanticTime
                value={date}
            >
                {'10:20'}
            </SemanticTime>,
        );

        expect(wrapper.find('time').text()).toBe('10:20');
    });

    test('should support custom label', () => {
        const date = new Date('2020-06-05T10:20:30Z');
        const wrapper = mount(
            <SemanticTime
                value={date}
                aria-label='A custom label'
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
