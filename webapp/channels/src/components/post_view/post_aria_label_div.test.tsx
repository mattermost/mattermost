// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactIntl from 'react-intl';

import enMessages from 'i18n/en.json';
import esMessages from 'i18n/es.json';
import {renderWithContext, screen} from 'tests/react_testing_utils';
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

    const baseProps: Omit<Props, 'ref'> = {
        post: TestHelper.getPostMock({
            user_id: author.id,
            message: 'This is a test.',
            create_at: new Date('2020-01-15T12:00:00Z').getTime(),
        }),
        autotranslated: false,
    };

    test('should render aria-label in the given locale', () => {
        (reactIntl.useIntl as jest.Mock).mockImplementation(() => reactIntl.createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'}));

        let renderResult = renderWithContext(<PostAriaLabelDiv {...baseProps}/>, baseState, {
            locale: 'en',
            intlMessages: enMessages,
        });

        let div = renderResult.container.firstChild as HTMLElement;
        expect(div.getAttribute('aria-label')).toContain(author.username);
        expect(div.getAttribute('aria-label')).toContain('January');

        (reactIntl.useIntl as jest.Mock).mockImplementation(() => reactIntl.createIntl({locale: 'es', messages: esMessages, defaultLocale: 'es'}));

        renderResult = renderWithContext(<PostAriaLabelDiv {...baseProps}/>, baseState, {
            locale: 'es',
            intlMessages: esMessages,
        });
        div = renderResult.container.firstChild as HTMLElement;

        expect(div.getAttribute('aria-label')).toContain(author.username);
        expect(div.getAttribute('aria-label')).toContain('enero');
    });

    test('should pass other props through to the rendered div', () => {
        (reactIntl.useIntl as jest.Mock).mockImplementation(() => reactIntl.createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'}));

        let props = baseProps;

        let renderResult = renderWithContext(<PostAriaLabelDiv {...props}/>, baseState, {
            locale: 'en',
            intlMessages: enMessages,
        });
        let div = renderResult.container.firstChild as HTMLElement;

        expect(div.className).toBe('');
        expect(div.getAttribute('data-something')).toBeNull();
        expect(div.childNodes.length).toBe(0);

        props = {
            ...props,
            className: 'some-class',
            'data-something': 'something',
        } as Props;

        renderResult = renderWithContext(
            <PostAriaLabelDiv {...props}>
                <p>{'This is a paragraph.'}</p>
            </PostAriaLabelDiv >,
            baseState,
            {
                locale: 'en',
                intlMessages: enMessages,
            },
        );
        div = renderResult.container.firstChild as HTMLElement;

        expect(div.className).toBe('some-class');
        expect(div.getAttribute('data-something')).toBe('something');
        expect(screen.getByText('This is a paragraph.')).toBeInTheDocument();
    });
});
