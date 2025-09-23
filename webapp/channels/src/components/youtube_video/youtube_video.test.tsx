// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount, shallow} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';

import type {DeepPartial} from '@mattermost/types/utilities';

import mockStore from 'tests/test_store';

import type {GlobalState} from 'types/store';

import YoutubeVideo from './youtube_video';

jest.mock('actions/integration_actions');

describe('YoutubeVideo', () => {
    const baseProps = {
        postId: 'post_id_1',
        googleDeveloperKey: 'googledevkey',
        hasImageProxy: false,
        link: 'https://www.youtube.com/watch?v=xqCoNej8Zxo',
        show: true,
        metadata: {
            title: 'Youtube title',
            images: [{
                secure_url: 'linkForThumbnail',
                url: 'linkForThumbnail',
            }],
        },
        youtubeReferrerPolicy: false,
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {},
                license: {
                    Cloud: 'true',
                },
            },
            users: {
                currentUserId: 'currentUserId',
            },
        },
    };

    test('should match init snapshot', () => {
        const store = mockStore(initialState);
        const wrapper = mount(
            <Provider store={store}>
                <YoutubeVideo {...baseProps}/>
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();

        // Verify that useMaxResThumbnail is true by default
        expect((wrapper.find('YoutubeVideo').instance() as YoutubeVideo).state.useMaxResThumbnail).toBe(true);
        expect(wrapper.find('h4').text()).toEqual('YouTube - Youtube title');
    });

    test('should match snapshot for playing state', () => {
        const wrapper = shallow(<YoutubeVideo {...baseProps}/>);
        wrapper.setState({playing: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for playing state and `youtubeReferrerPolicy = true`', () => {
        const wrapper = shallow(
            <YoutubeVideo
                {...baseProps}
                youtubeReferrerPolicy={true}
            />,
        );
        wrapper.setState({playing: true});
        expect(wrapper).toMatchSnapshot();

        // Verify that the iframe has a referrerPolicy attribute (set to 'origin') when youtubeReferrerPolicy is true.
        expect(wrapper.find('.video-playing iframe').prop('referrerPolicy')).toEqual('origin');

        // Verify that the iframe src includes the new parameters
        expect(wrapper.find('.video-playing iframe').prop('src')).toEqual('https://www.youtube.com/embed/xqCoNej8Zxo?autoplay=1&rel=0&fs=1&enablejsapi=1');
    });

    test('should use url if secure_url is not present', () => {
        const props = {
            ...baseProps,
            metadata: {
                title: 'Youtube title',
                images: [{
                    url: 'linkUrl',
                }],
            },
        };
        const wrapper = shallow(<YoutubeVideo {...props}/>);

        // Verify that useMaxResThumbnail is true by default
        expect(wrapper.state('useMaxResThumbnail')).toBe(true);
    });

    describe('thumbnail fallback', () => {
        it('should fallback to hqdefault.jpg on image error', () => {
            const wrapper = shallow(<YoutubeVideo {...baseProps}/>);

            // Simulate an image error by calling handleImageError.
            (wrapper.instance() as YoutubeVideo).handleImageError();

            // Verify that useMaxResThumbnail is now false (will use hqdefault.jpg).
            expect(wrapper.state('useMaxResThumbnail')).toBe(false);
        });
    });

    it('should initialize with useMaxResThumbnail set to true', () => {
        const wrapper = shallow(<YoutubeVideo {...baseProps}/>);

        // Verify that the component initializes with useMaxResThumbnail = true
        expect(wrapper.state('useMaxResThumbnail')).toBe(true);
    });
});
