// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import LocalizedIcon from './localized_icon';

describe('LocalizedIcon', () => {
    const baseProps = {
        title: {
            id: 'test.id',
            defaultMessage: 'test default message',
        },
    };

    test('should render localized title', () => {
        const wrapper = mountWithIntl(<LocalizedIcon {...baseProps}/>);

        expect(wrapper.find('i').prop('title')).toBe(baseProps.title.defaultMessage);
    });

    test('should render using given component', () => {
        const props = {
            ...baseProps,
        };

        const wrapper = mountWithIntl(
            <LocalizedIcon
                component='span'
                {...props}
            />,
        );

        expect(wrapper.find('i').exists()).toBe(false);
        expect(wrapper.find('span').exists()).toBe(true);
        expect(wrapper.find('span').prop('title')).toBe(baseProps.title.defaultMessage);
    });

    test('should pass other props to component', () => {
        const props = {
            ...baseProps,
            className: 'my-icon',
        };

        const wrapper = mountWithIntl(<LocalizedIcon {...props}/>);

        expect(wrapper.find('i').prop('className')).toBe(props.className);
    });
});
