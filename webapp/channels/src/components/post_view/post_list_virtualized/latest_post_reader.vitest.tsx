// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {createIntl, useIntl} from 'react-intl';

import enMessages from 'i18n/en.json';
import esMessages from 'i18n/es.json';
import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import LatestPostReader from './latest_post_reader';

vi.mock('react-intl', async (importOriginal) => {
    const original = await importOriginal<typeof import('react-intl')>();
    return {
        ...original,
        useIntl: vi.fn(),
    };
});

describe('LatestPostReader', () => {
    const author = TestHelper.getUserMock({
        username: 'some_user',
    });

    const post = TestHelper.getPostMock({
        user_id: author.id,
        message: 'This is a test.',
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
                posts: {
                    [post.id]: post,
                },
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
        postIds: [post.id],
    };

    test('should render aria-label as a child in the given locale', () => {
        (useIntl as ReturnType<typeof vi.fn>).mockImplementation(() => createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'}));

        const {rerender} = renderWithContext(
            <LatestPostReader {...baseProps}/>,
            baseState,
        );

        const prevMessage = screen.getByText(`January 1, ${author.username} wrote, This is a test`, {exact: false});
        expect(prevMessage).toBeInTheDocument();
        expect(prevMessage).toHaveClass('sr-only');

        (useIntl as ReturnType<typeof vi.fn>).mockImplementation(() => createIntl({locale: 'es', messages: esMessages, defaultLocale: 'es'}));

        rerender(<LatestPostReader {...baseProps}/>);

        // Spanish format: "some_user escribió, This is a test., el jueves, 1 de enero a las 0:00"
        const message = screen.getByText(`${author.username} escribió, This is a test`, {exact: false});

        expect(message).toBeInTheDocument();
        expect(message).toHaveClass('sr-only');
    });

    test('should be able to handle an empty post array', () => {
        const props = {
            ...baseProps,
            postIds: [],
        };

        renderWithContext(<LatestPostReader {...props}/>, baseState);

        // body should be empty
        const message = screen.queryByText('This is a test');
        expect(message).not.toBeInTheDocument();
    });
});
