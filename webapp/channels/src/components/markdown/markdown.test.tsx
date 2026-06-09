// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {TeamType} from '@mattermost/types/teams';

import Markdown from 'components/markdown';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import EmojiMap from 'utils/emoji_map';
import {TestHelper} from 'utils/test_helper';

describe('components/Markdown', () => {
    const baseProps = {
        channelNamesMap: {},
        enableFormatting: true,
        mentionKeys: [],
        message: 'This _is_ some **Markdown**',
        siteURL: 'https://markdown.example.com',
        team: TestHelper.getTeamMock({
            id: 'id123',
            invite_id: 'invite_id123',
            name: 'yourteamhere',
            create_at: 1,
            update_at: 2,
            delete_at: 3,
            display_name: 'test',
            description: 'test',
            email: 'test@test.com',
            type: 'T' as TeamType,
            company_name: 'test',
            allowed_domains: 'test',
            allow_open_invite: false,
            scheme_id: 'test',
            group_constrained: false,
        }),
        hasImageProxy: false,
        minimumHashtagLength: 3,
        emojiMap: new EmojiMap(new Map()),
        metadata: {},
    };

    test('should render properly', () => {
        const {container} = renderWithContext(<Markdown {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should not render markdown when formatting is disabled', () => {
        const props = {
            ...baseProps,
            enableFormatting: false,
        };

        const {container} = renderWithContext(<Markdown {...props}/>);
        expect(container).toMatchSnapshot();
    });

    describe('image proxy', () => {
        const imageUrl = 'https://example.com/image.png';

        test('when the proxy is enabled, images should be requested through the server', () => {
            const props = {...baseProps, message: `![alt](${imageUrl})`};

            renderWithContext(<Markdown {...props}/>, {
                entities: {
                    general: {
                        config: {
                            HasImageProxy: 'true',
                        },
                    },
                },
            });

            const img = screen.getByRole('img');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', expect.stringMatching(`/image\\?url=${encodeURIComponent(imageUrl)}$`));
        });

        test('when the proxy is disabled, images should not be requested through the server', () => {
            const props = {...baseProps, message: `![alt](${imageUrl})`};

            renderWithContext(<Markdown {...props}/>, {
                entities: {
                    general: {
                        config: {
                            HasImageProxy: 'false',
                        },
                    },
                },
            });

            const img = screen.getByRole('img');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', imageUrl);
        });

        test('when the proxy is enabled, image URLs containing query parameters should be correctly encoded', () => {
            const urlWithParams = 'https://example.com/image.png?width=100&height=200';
            const props = {...baseProps, message: `![alt](${urlWithParams})`};

            renderWithContext(<Markdown {...props}/>, {
                entities: {
                    general: {
                        config: {
                            HasImageProxy: 'true',
                        },
                    },
                },
            });

            const img = screen.getByRole('img');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', expect.stringMatching(`/image\\?url=${encodeURIComponent(urlWithParams)}$`));
        });
    });
});
