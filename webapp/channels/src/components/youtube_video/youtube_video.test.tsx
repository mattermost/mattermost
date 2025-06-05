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
                <YoutubeVideo {...baseProps} />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
        // Verify that the thumbnail is set to maxresdefault.jpg by default.
        expect(wrapper.find('img.video-thumbnail').prop('src')).toEqual('https://img.youtube.com/vi/xqCoNej8Zxo/maxresdefault.jpg');
        expect(wrapper.find('a').text()).toEqual('Youtube title');
    });

    test('should match snapshot for playing state', () => {
        const wrapper = shallow(<YoutubeVideo {...baseProps} />);
        wrapper.setState({ playing: true });
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for playing state and `youtubeReferrerPolicy = true`', () => {
        const wrapper = shallow(
            <YoutubeVideo
                {...baseProps}
                youtubeReferrerPolicy={true}
            />,
        );
        wrapper.setState({ playing: true });
        expect(wrapper).toMatchSnapshot();
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
        const wrapper = shallow(<YoutubeVideo {...props} />);
        // Verify that the thumbnail is set to maxresdefault.jpg by default.
        expect(wrapper.find('img.video-thumbnail').prop('src')).toEqual('https://img.youtube.com/vi/xqCoNej8Zxo/maxresdefault.jpg');
    });

    describe('thumbnail fallback', () => {
        it('should fallback to hqdefault.jpg on image error', () => {
            const wrapper = shallow(<YoutubeVideo {...baseProps} />);
            // Simulate an image error by calling handleImageError.
            (wrapper.instance() as YoutubeVideo).handleImageError();
            // Verify that the thumbnail is now hqdefault.jpg.
            expect(wrapper.state('thumbnailUrl')).toEqual('https://img.youtube.com/vi/xqCoNej8Zxo/hqdefault.jpg');
        });
    });
});
