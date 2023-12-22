// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount} from 'enzyme';
import React from 'react';
import * as reactIntl from 'react-intl';

import enMessages from 'i18n/en.json';
import esMessages from 'i18n/es.json';
import {mockStore} from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

import PostAriaLabelDiv from './post_aria_label_div';
import type {Props} from './post_aria_label_div';

jest.mock('react-intl', () => ({
    ...jest.requireActual('react-intl'),
    useIntl: jest.fn(),
}));

describe('PostAriaLabelDiv', () => {
    const author = TestHelper.getUserMock({
        username: 'some_user',
    });

    const baseState = {
        entities: {
            emojis: {
                customEmoji: {},
            },
            general: {
                config: {},
            },
            posts: {
                reactions: {},
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                profiles: {
                    [author.id]: author,
                },
            },
        },
    };

    const baseProps = {
        post: TestHelper.getPostMock({
            user_id: author.id,
            message: 'This is a test.',
        }),
    } as Omit<Props, 'ref'>;

    test('should render aria-label in the given locale', () => {
        const {mountOptions} = mockStore(baseState);

        (reactIntl.useIntl as jest.Mock).mockImplementation(() => reactIntl.createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'}));

        let wrapper = mount(<PostAriaLabelDiv {...baseProps}/>, mountOptions);
        let div = wrapper.childAt(0);

        expect(div.prop('aria-label')).toContain(author.username);
        expect(div.prop('aria-label')).toContain('January');

        (reactIntl.useIntl as jest.Mock).mockImplementation(() => reactIntl.createIntl({locale: 'es', messages: esMessages, defaultLocale: 'es'}));

        wrapper = mount(<PostAriaLabelDiv {...baseProps}/>, mountOptions);
        div = wrapper.childAt(0);

        expect(div.prop('aria-label')).toContain(author.username);
        expect(div.prop('aria-label')).toContain('enero');
    });

    test('should pass other props through to the rendered div', () => {
        const {mountOptions} = mockStore(baseState);

        (reactIntl.useIntl as jest.Mock).mockImplementation(() => reactIntl.createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'}));

        let props = baseProps;

        let wrapper = mount(<PostAriaLabelDiv {...props}/>, mountOptions);
        let div = wrapper.childAt(0);

        expect(div.prop('className')).toBeUndefined();
        expect(div.prop('data-something')).toBeUndefined();
        expect(div.children()).toHaveLength(0);

        props = {
            ...props,
            className: 'some-class',
            'data-something': 'something',
        } as Props;

        wrapper = mount(
            <PostAriaLabelDiv {...props}>
                <p>{'This is a paragraph.'}</p>
            </PostAriaLabelDiv >,
            mountOptions,
        );
        div = wrapper.childAt(0);

        expect(div.prop('className')).toBe('some-class');
        expect(div.prop('data-something')).toBe('something');
        expect(div.children()).toHaveLength(1);
    });
});
