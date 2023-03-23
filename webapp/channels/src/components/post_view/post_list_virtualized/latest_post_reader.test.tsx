// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount} from 'enzyme';
import React from 'react';
import {createIntl, useIntl} from 'react-intl';

import enMessages from 'i18n/en.json';
import esMessages from 'i18n/es.json';

import {mockStore} from 'tests/test_store';

import {TestHelper} from 'utils/test_helper';

import LatestPostReader from './latest_post_reader';

jest.mock('react-intl', () => ({
    ...jest.requireActual('react-intl'),
    useIntl: jest.fn(),
}));

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
        const {mountOptions} = mockStore(baseState);

        (useIntl as jest.Mock).mockImplementation(() => createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'}));

        let wrapper = mount(<LatestPostReader {...baseProps}/>, mountOptions);
        let span = wrapper.childAt(0);

        expect(span.prop('children')).toContain(author.username);
        expect(span.prop('children')).toContain('January');

        (useIntl as jest.Mock).mockImplementation(() => createIntl({locale: 'es', messages: esMessages, defaultLocale: 'es'}));

        wrapper = mount(<LatestPostReader {...baseProps}/>, mountOptions);
        span = wrapper.childAt(0);

        expect(span.prop('children')).toContain(author.username);
        expect(span.prop('children')).toContain('enero');
    });
});
