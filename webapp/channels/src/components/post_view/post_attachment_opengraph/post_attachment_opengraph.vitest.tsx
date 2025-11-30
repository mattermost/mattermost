// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';
import React from 'react';

import type {OpenGraphMetadata, Post} from '@mattermost/types/posts';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {Preferences} from 'utils/constants';

import {getBestImage, getIsLargeImage, PostAttachmentOpenGraphImage, PostAttachmentOpenGraphBody} from './post_attachment_opengraph';

import PostAttachmentOpenGraph from './index';

const preferenceKeys = {
    COLLAPSE_DISPLAY: getPreferenceKey(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLLAPSE_DISPLAY),
    LINK_PREVIEW_DISPLAY: getPreferenceKey(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.LINK_PREVIEW_DISPLAY),
};

const openGraphData = {
    description: 'Mattermost is a secure, open source platform for communication, collaboration, and workflow orchestration across tools and teams.',
    images: [{
        height: 1256,
        secure_url: 'http://localhost:8065/api/v4/image?url=http%3A%2F%2Fmattermo…t.com%2Fwp-content%2Fuploads%2F2021%2F09%2FHomepage%402x.png',
        type: 'image/png',
        url: '',
        width: 2400}],
    site_name: 'Mattermost.com',
    title: 'Mattermost | Open Source Collaboration for Developers',
    type: 'website',
    url: 'https://www.mattermost.com',
};

const initialState = {
    entities: {
        general: {
            config: {
                EnableLinkPreviews: 'true',
                EnableSVGs: 'true',
                HasImageProxy: 'true',
            },
        },
        preferences: {
            myPreferences: {
                [preferenceKeys.COLLAPSE_DISPLAY]: {value: Preferences.COLLAPSE_DISPLAY_DEFAULT},
                [preferenceKeys.LINK_PREVIEW_DISPLAY]: {value: Preferences.LINK_PREVIEW_DISPLAY_DEFAULT},
            },
        },
        teams: {
            currentTeamId: 'team-id',
        },
        users: {
            currentUserId: 'user-1',
        },
        posts: {
            openGraph: {
                post_id_1: {
                    [openGraphData.url]: openGraphData,
                },
            },
        },
    },
};

describe('PostAttachmentOpenGraph', () => {
    const imageUrl = 'http://mattermost.com/OpenGraphImage.jpg';
    const toggleEmbedVisibility = vi.fn();
    const post = {
        id: 'post_id_1',
        root_id: 'root_id',
        channel_id: 'channel_id',
        create_at: 1,
        message: 'https://mattermost.com',
        metadata: {
            images: {
                [imageUrl]: {
                    format: 'png',
                    frameCount: 0,
                    height: 100,
                    width: 100,
                },
            },
        },
    } as unknown as Post;

    const baseProps = {
        post,
        postId: '',
        link: 'http://mattermost.com',
        currentUserId: '1234',
        openGraphData: {
            description: 'description',
            images: [{
                secure_url: '',
                url: imageUrl,
            }],
            site_name: 'Mattermost',
            title: 'Mattermost Private Cloud Messaging',
        },
        toggleEmbedVisibility,
        actions: {
            editPost: vi.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <PostAttachmentOpenGraph {...baseProps}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render nothing without any data', () => {
        const state = cloneDeep(initialState);
        set(state, 'entities.posts.openGraph', {});

        const {container} = renderWithContext(
            <PostAttachmentOpenGraph {...baseProps}/>,
            state,
        );

        expect(container.firstChild).toBeNull();
    });

    test('should render nothing when link previews are disabled on the server', () => {
        const state = cloneDeep(initialState);
        set(state, 'entities.general.config.EnableLinkPreviews', 'false');

        const {container} = renderWithContext(
            <PostAttachmentOpenGraph {...baseProps}/>,
            state,
        );

        expect(container.firstChild).toBeNull();
    });

    test('should render nothing when link previews are disabled by the user', () => {
        const state = cloneDeep(initialState);
        set(state, `entities.preferences.myPreferences["${preferenceKeys.LINK_PREVIEW_DISPLAY}"].value`, 'false');

        const {container} = renderWithContext(
            <PostAttachmentOpenGraph {...baseProps}/>,
            state,
        );

        expect(container.firstChild).toBeNull();
    });
});

describe('PostAttachmentOpenGraphBody', () => {
    const baseProps = {
        title: 'test-title',
        sitename: 'test-sitename',
        description: 'test-description',
        isInPermalink: false,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<PostAttachmentOpenGraphBody {...baseProps}/>);

        expect(container).toMatchSnapshot();
    });

    test('should not render without title', () => {
        const props = cloneDeep(baseProps);
        set(props, 'title', '');

        const {container} = renderWithContext(<PostAttachmentOpenGraphBody {...props}/>);

        expect(container.firstChild).toBeNull();
    });

    test('should add extra class for permalink view', () => {
        const props = cloneDeep(baseProps);
        set(props, 'isInPermalink', true);

        const {container} = renderWithContext(<PostAttachmentOpenGraphBody {...props}/>);

        expect(container.querySelector('.isInPermalink')).toBeInTheDocument();
        expect(container.querySelector('.sitename')).not.toBeInTheDocument();
    });

    test('should render without sitename', () => {
        const props = cloneDeep(baseProps);
        set(props, 'sitename', '');

        const {container} = renderWithContext(<PostAttachmentOpenGraphBody {...props}/>);

        expect(container.querySelector('.sitename')).not.toBeInTheDocument();
        expect(container.querySelector('.title')).toBeInTheDocument();
        expect(container.querySelector('.description')).toBeInTheDocument();
    });

    test('should render without description', () => {
        const props = cloneDeep(baseProps);
        set(props, 'description', '');

        const {container} = renderWithContext(<PostAttachmentOpenGraphBody {...props}/>);

        expect(container.querySelector('.sitename')).toBeInTheDocument();
        expect(container.querySelector('.title')).toBeInTheDocument();
        expect(container.querySelector('.description')).not.toBeInTheDocument();
    });

    test('should render with title only', () => {
        const props = cloneDeep(baseProps);
        set(props, 'sitename', '');
        set(props, 'description', '');

        const {container} = renderWithContext(<PostAttachmentOpenGraphBody {...props}/>);

        expect(container.querySelector('.sitename')).not.toBeInTheDocument();
        expect(container.querySelector('.title')).toBeInTheDocument();
        expect(container.querySelector('.description')).not.toBeInTheDocument();
    });
});

describe('PostAttachmentOpenGraphImage', () => {
    const baseProps = {
        imageMetadata: getBestImage(openGraphData),
        isInPermalink: false,
        toggleEmbedVisibility: vi.fn(),
        isEmbedVisible: true,
        title: 'test_image',
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <PostAttachmentOpenGraphImage {...baseProps}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should not render when used in Permalink', () => {
        const props = cloneDeep(baseProps);
        set(props, 'isInPermalink', true);

        const {container} = renderWithContext(
            <PostAttachmentOpenGraphImage {...props}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render a large image with toggle', () => {
        const {container} = renderWithContext(
            <PostAttachmentOpenGraphImage {...baseProps}/>,
            initialState,
        );

        expect(container.querySelector('.PostAttachmentOpenGraph__image')).toBeInTheDocument();
        expect(container.querySelector('.PostAttachmentOpenGraph__image.large')).toBeInTheDocument();
        expect(container.querySelector('.PostAttachmentOpenGraph__image .preview-toggle')).toBeInTheDocument();
    });

    test('should render a small image without toggle', () => {
        const props = cloneDeep(baseProps);
        set(props, 'imageMetadata.height', 90);
        set(props, 'imageMetadata.width', 120);

        const {container} = renderWithContext(
            <PostAttachmentOpenGraphImage {...props}/>,
            initialState,
        );

        expect(container.querySelector('.PostAttachmentOpenGraph__image')).toBeInTheDocument();
        expect(container.querySelector('.PostAttachmentOpenGraph__image.large')).not.toBeInTheDocument();
        expect(container.querySelector('.PostAttachmentOpenGraph__image .preview-toggle')).not.toBeInTheDocument();
    });
});

describe('PostAttachmentOpenGraphBody', () => {
    const baseProps = {
        title: 'test_title',
        isInPermalink: false,
        siteName: 'test_sitename',
        description: 'test_description',
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <PostAttachmentOpenGraphBody {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    // Note: In Jest, the describe('permalink preview') block runs assertions directly
    // without a test() wrapper, which is unusual. RTL tests verify this behavior in
    // the 'should add extra class for permalink view' test in PostAttachmentOpenGraphBody describe above.
});

describe('Helpers', () => {
    describe('getBestImage', () => {
        test('should return nothing with missing OpenGraph images', () => {
            const openGraphData = {} as OpenGraphMetadata;
            const imageData = getBestImage(openGraphData);
            const imageUrl = imageData?.secure_url || imageData?.url;

            expect(imageUrl).toBeFalsy();
        });

        test('should return nothing with no OpenGraph images', () => {
            const openGraphData = {
                images: [],
            };

            const imageData = getBestImage(openGraphData);
            const imageUrl = imageData?.secure_url || imageData?.url;

            expect(imageUrl).toBeFalsy();
        });

        test('should return secure_url if specified', () => {
            const openGraphData = {
                images: [{
                    secure_url: 'https://example.com/image.png',
                    url: 'http://example.com/image.png',
                }],
            };

            const imageData = getBestImage(openGraphData);
            const imageUrl = imageData?.secure_url || imageData?.url;

            expect(imageUrl).toEqual(openGraphData.images[0].secure_url);
        });

        test('should handle undefined metadata', () => {
            const openGraphData = {
                images: [{
                    secure_url: 'https://example.com/image.png',
                    url: 'http://example.com/image.png',
                }],
            };

            const imagesMetadata = {};

            const imageData = getBestImage(openGraphData, imagesMetadata);
            const imageUrl = imageData?.secure_url || imageData?.url;

            expect(imageUrl).toEqual(openGraphData.images[0].secure_url);
        });

        test('should return url if secure_url is not specified', () => {
            const openGraphData = {
                images: [{
                    secure_url: '',
                    url: 'http://example.com/image.png',
                }],
            };

            const imageData = getBestImage(openGraphData);
            const imageUrl = imageData?.secure_url || imageData?.url;

            expect(imageUrl).toEqual(openGraphData.images[0].url);
        });

        test('should pick the first image if no dimensions are specified', () => {
            const openGraphData = {
                images: [{
                    url: 'http://example.com/image.png',
                }, {
                    url: 'http://example.com/image2.png',
                }],
            };

            const imageData = getBestImage(openGraphData);
            const imageUrl = imageData?.secure_url || imageData?.url;

            expect(imageUrl).toEqual(openGraphData.images[0].url);
        });

        test('should prefer images with dimensions closer to 80 by 80', () => {
            const openGraphData = {
                images: [{
                    url: 'http://example.com/image.png',
                    height: 100,
                    width: 100,
                }, {
                    url: 'http://example.com/image2.png',
                    height: 1000,
                    width: 1000,
                }],
            };

            const imageData = getBestImage(openGraphData);
            const imageUrl = imageData?.secure_url || imageData?.url;

            expect(imageUrl).toEqual(openGraphData.images[0].url);
        });

        test('should use dimensions from post metadata if necessary', () => {
            const openGraphData = {
                images: [{
                    url: 'http://example.com/image.png',
                }, {
                    url: 'http://example.com/image2.png',
                }],
            };
            const imagesMetadata = {
                'http://example.com/image.png': {
                    format: 'png',
                    frameCount: 0,
                    height: 100,
                    width: 100,
                },
                'http://example.com/image2.png': {
                    format: 'png',
                    frameCount: 0,
                    height: 1000,
                    width: 1000,
                },
            };

            const imageData = getBestImage(openGraphData, imagesMetadata);
            const imageUrl = imageData?.secure_url || imageData?.url;

            expect(imageUrl).toEqual(openGraphData.images[0].url);
        });
    });

    describe('isLargeImage', () => {
        test('should be a large image', () => {
            expect(getIsLargeImage({
                format: 'png',
                frameCount: 0,
                height: 180,
                width: 400,
            })).toBe(true);
        });

        test('should not be a large image', () => {
            expect(getIsLargeImage({
                format: 'png',
                frameCount: 0,
                height: 100,
                width: 100,
            })).toBe(false);
        });
    });
});
