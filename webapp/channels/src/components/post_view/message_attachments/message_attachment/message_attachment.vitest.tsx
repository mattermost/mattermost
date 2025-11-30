// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PostAction} from '@mattermost/types/integration_actions';
import type {MessageAttachment as MessageAttachmentType} from '@mattermost/types/message_attachments';
import type {PostImage} from '@mattermost/types/posts';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {Constants} from 'utils/constants';

import MessageAttachment from './message_attachment';

describe('components/post_view/MessageAttachment', () => {
    const attachment = {
        pretext: 'pretext',
        author_name: 'author_name',
        author_icon: 'author_icon',
        author_link: 'author_link',
        title: 'title',
        title_link: 'title_link',
        text: 'short text',
        image_url: 'image_url',
        thumb_url: 'thumb_url',
        color: '#FFF',
        footer: 'footer',
        footer_icon: 'footer_icon',
    } as MessageAttachmentType;

    const baseProps = {
        postId: 'post_id',
        attachment,
        currentRelativeTeamUrl: 'dummy_team',
        actions: {
            doPostActionWithCookie: vi.fn(),
            openModal: vi.fn(),
        },
        imagesMetadata: {
            image_url: {
                height: 200,
                width: 200,
            } as PostImage,
            thumb_url: {
                height: 200,
                width: 200,
            } as PostImage,
        } as Record<string, PostImage>,
    };

    const initialState = {
        entities: {
            general: {config: {}},
            users: {
                currentUserId: 'user_id',
                profiles: {},
            },
            emojis: {customEmoji: {}},
            channels: {},
            teams: {teams: {}},
            preferences: {myPreferences: {}},
            groups: {groups: {}, myGroups: []},
        },
    } as any;

    test('should match snapshot', () => {
        const {container} = renderWithContext(<MessageAttachment {...baseProps}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should match value on renderPostActions', () => {
        const newAttachment = {
            ...attachment,
            actions: [
                {id: 'action_id_1', name: 'action_name_1'},
                {id: 'action_id_2', name: 'action_name_2'},
                {id: 'action_id_3', name: 'action_name_3', type: 'select', data_source: 'users'},
            ],
        };

        const props = {...baseProps, attachment: newAttachment};

        const {container} = renderWithContext(<MessageAttachment {...props}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should call actions.doPostActionWithCookie on handleAction', async () => {
        const promise = Promise.resolve({data: 123});
        const doPostActionWithCookie = vi.fn(() => promise);
        const openModal = vi.fn();
        const actionId = 'action_id_1';
        const newAttachment = {
            ...attachment,
            actions: [{id: actionId, name: 'action_name_1', cookie: 'cookie-contents'}] as PostAction[],
        };
        const props = {...baseProps, actions: {doPostActionWithCookie, openModal}, attachment: newAttachment};
        renderWithContext(<MessageAttachment {...props}/>, initialState);

        // Find and click the action button
        const actionButton = screen.getByText('action_name_1');
        actionButton.click();

        expect(doPostActionWithCookie).toHaveBeenCalledTimes(1);
    });

    test('should match snapshot when the attachment has an emoji in the title', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'Do you like :pizza:?',
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>, initialState);

        expect(container).toMatchSnapshot();
    });

    test("should match snapshot when the attachment hasn't any emojis in the title", () => {
        const props = {
            ...baseProps,
            attachment: {
                title: "Don't you like emojis?",
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>, initialState);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when the attachment has a link in the title', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'Do you like https://mattermost.com?',
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>, initialState);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when no footer is provided (even if footer_icon is provided)', () => {
        const props = {
            ...baseProps,
            attachment: {
                ...attachment,
                footer: '',
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>, initialState);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when the footer is truncated', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'footer',
                footer: 'a'.repeat(Constants.MAX_ATTACHMENT_FOOTER_LENGTH + 1),
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>, initialState);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot and render a field with a number value', () => {
        const props = {
            ...baseProps,
            attachment: {
                ...attachment,
                fields: [
                    {
                        title: 'this is the title',
                        value: 1234,
                    },
                ],
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>, initialState);

        expect(container.querySelector('.attachment-field')).toMatchSnapshot();
    });

    test('should not render content box if there is no content', () => {
        const props = {
            ...baseProps,
            attachment: {
                pretext: 'This is a pretext.',
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>, initialState);
        expect(container.querySelector('.attachment')).toMatchSnapshot();
    });
});
