// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount, shallow} from 'enzyme';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import type {DeepPartial} from '@mattermost/types/utilities';

import ExternalImage from 'components/external_image';

import {renderWithContext, screen} from 'tests/react_testing_utils';
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
            <IntlProvider locale='en'>
                <Provider store={store}>
                    <YoutubeVideo {...baseProps}/>
                </Provider>
            </IntlProvider>,
        );
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(ExternalImage).prop('src')).toEqual('linkForThumbnail');
        expect(wrapper.find('a').text()).toEqual('Youtube title');
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

        expect(wrapper.find(ExternalImage).prop('src')).toEqual('linkUrl');
    });

    test('should match init snapshot (Shorts)', () => {
        const store = mockStore(initialState);
        const props = {
            ...baseProps,
            link: 'https://www.youtube.com/shorts/2oa5WCUpwD8',
        };
        const wrapper = mount(
            <IntlProvider locale='en'>
                <Provider store={store}>
                    <YoutubeVideo {...props}/>
                </Provider>
            </IntlProvider>,
        );
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(ExternalImage).prop('src')).toEqual('linkForThumbnail');
        expect(wrapper.find('a').text()).toEqual('Youtube title');
        expect(wrapper.find('.video-shorts').exists()).toBe(true);
        expect(wrapper.find('.video-shorts-expanded').exists()).toBe(false);
    });

    test('should match snapshot for playing state (Shorts)', () => {
        renderWithContext(
            <YoutubeVideo
                {...baseProps}
                link={'https://www.youtube.com/shorts/2oa5WCUpwD8'}
            />,
            initialState,
        );

        expect(screen.getByTestId('youtube-video')).toHaveClass('video-shorts');
    });

    test('should match snapshot for playing state and shortsExpanded state (Shorts)', () => {
        renderWithContext(
            <YoutubeVideo
                {...baseProps}
                link={'https://www.youtube.com/shorts/2oa5WCUpwD8'}
            />,
            initialState,
        );

        screen.getByTestId('youtube-expand-shorts').click();

        expect(screen.getByTestId('youtube-video')).toHaveClass('video-shorts-expanded');
    });
});
