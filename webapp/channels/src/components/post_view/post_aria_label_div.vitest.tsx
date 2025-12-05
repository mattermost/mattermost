// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactIntl from 'react-intl';

import enMessages from 'i18n/en.json';
import esMessages from 'i18n/es.json';
import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PostAriaLabelDiv from './post_aria_label_div';
import type {Props} from './post_aria_label_div';

vi.mock('react-intl', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-intl')>();
    return {
        ...actual,
        useIntl: vi.fn(),
    };
});

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
        (reactIntl.useIntl as ReturnType<typeof vi.fn>).mockImplementation(() => reactIntl.createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'}));

        const {rerender, container} = renderWithContext(<PostAriaLabelDiv {...baseProps}/>, baseState);
        let div = container.querySelector('div[aria-label]') as HTMLDivElement;

        expect(div.getAttribute('aria-label')).toContain(author.username);
        expect(div.getAttribute('aria-label')).toContain('January');

        (reactIntl.useIntl as ReturnType<typeof vi.fn>).mockImplementation(() => reactIntl.createIntl({locale: 'es', messages: esMessages, defaultLocale: 'es'}));

        rerender(<PostAriaLabelDiv {...baseProps}/>);
        div = container.querySelector('div[aria-label]') as HTMLDivElement;

        expect(div.getAttribute('aria-label')).toContain(author.username);
        expect(div.getAttribute('aria-label')).toContain('enero');
    });

    test('should pass other props through to the rendered div', () => {
        (reactIntl.useIntl as ReturnType<typeof vi.fn>).mockImplementation(() => reactIntl.createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'}));

        let props = baseProps;

        const {rerender, container} = renderWithContext(<PostAriaLabelDiv {...props}/>, baseState);
        let div = container.querySelector('div[aria-label]') as HTMLDivElement;

        expect(div.className).toBe('');
        expect(div.getAttribute('data-something')).toBeNull();
        expect(div.children).toHaveLength(0);

        props = {
            ...props,
            className: 'some-class',
            'data-something': 'something',
        } as Props;

        rerender(
            <PostAriaLabelDiv {...props}>
                <p>{'This is a paragraph.'}</p>
            </PostAriaLabelDiv>,
        );
        div = container.querySelector('div[aria-label]') as HTMLDivElement;

        expect(div.className).toBe('some-class');
        expect(div.getAttribute('data-something')).toBe('something');
        expect(div.children).toHaveLength(1);
    });
});
