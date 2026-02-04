// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PostType, PostMetadata} from '@mattermost/types/posts';

import DeletePostModal from 'components/delete_post_modal/delete_post_modal';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

describe('components/delete_post_modal', () => {
    const post = {
        id: '123',
        message: 'test',
        channel_id: '5',
        type: '' as PostType,
        root_id: '',
        create_at: 0,
        update_at: 0,
        edit_at: 0,
        delete_at: 0,
        is_pinned: false,
        user_id: '',
        original_id: '',
        props: {} as Record<string, any>,
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {} as PostMetadata,
        remote_id: '',
    };

    const baseProps = {
        post,
        commentCount: 0,
        isRHS: false,
        actions: {
            deleteAndRemovePost: jest.fn(),
        },
        onExited: jest.fn(),
        channelName: 'channel_name',
        teamName: 'team_name',
        location: {
            pathname: '',
        },
    };

    test('should match snapshot for delete_post_modal with 0 comments', () => {
        const {baseElement} = renderWithContext(
            <DeletePostModal {...baseProps}/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot for delete_post_modal with 1 comment', () => {
        const commentCount = 1;
        const props = {...baseProps, commentCount};
        const {baseElement} = renderWithContext(
            <DeletePostModal {...props}/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot for post with 1 commentCount and is not rootPost', () => {
        const commentCount = 1;
        const postObj = {
            ...post,
            root_id: '1234',
        };

        const props = {
            ...baseProps,
            commentCount,
            post: postObj,
        };

        const {baseElement} = renderWithContext(
            <DeletePostModal {...props}/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should focus delete button on enter', async () => {
        renderWithContext(
            <DeletePostModal {...baseProps}/>,
        );

        // Wait for modal to be entered and focus applied
        await waitFor(() => {
            const deleteButton = screen.getByRole('button', {name: 'Delete'});
            expect(deleteButton).toHaveFocus();
        });
    });

    test('should hide on Cancel', async () => {
        renderWithContext(
            <DeletePostModal {...baseProps}/>,
        );

        // Modal should be visible
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Click cancel to trigger onHide
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        // Modal should be hidden
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('should match state when the cancel button is clicked', async () => {
        renderWithContext(
            <DeletePostModal {...baseProps}/>,
        );

        // Modal should be visible
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Click cancel button
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        // Modal should be hidden
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('should have called actions.deleteAndRemovePost on Delete', async () => {
        const deleteAndRemovePost = jest.fn().mockReturnValueOnce({data: true});
        const props = {
            ...baseProps,
            actions: {
                deleteAndRemovePost,
            },
            location: {
                pathname: '/teamname/messages/@username',
            },
        };
        renderWithContext(
            <DeletePostModal {...props}/>,
        );

        // Modal should be visible
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Click delete button
        await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

        await waitFor(() => {
            expect(deleteAndRemovePost).toHaveBeenCalledTimes(1);
        });
        expect(deleteAndRemovePost).toHaveBeenCalledWith(props.post);

        // Modal should be hidden
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('should have called browserHistory.replace when permalink post is deleted for DM/GM', async () => {
        const deleteAndRemovePost = jest.fn().mockReturnValueOnce({data: true});
        const props = {
            ...baseProps,
            actions: {
                deleteAndRemovePost,
            },
            location: {
                pathname: '/teamname/messages/@username/123',
            },
        };

        renderWithContext(
            <DeletePostModal {...props}/>,
        );

        // Click delete button
        await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

        await waitFor(() => {
            expect(deleteAndRemovePost).toHaveBeenCalledTimes(1);
        });
        expect(getHistory().replace).toHaveBeenCalledWith('/teamname/messages/@username');
    });

    test('should have called browserHistory.replace when permalink post is deleted for a channel', async () => {
        const deleteAndRemovePost = jest.fn().mockReturnValueOnce({data: true});
        const props = {
            ...baseProps,
            actions: {
                deleteAndRemovePost,
            },
            location: {
                pathname: '/teamname/channels/channelName/123',
            },
        };

        renderWithContext(
            <DeletePostModal {...props}/>,
        );

        // Click delete button
        await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

        await waitFor(() => {
            expect(deleteAndRemovePost).toHaveBeenCalledTimes(1);
        });
        expect(getHistory().replace).toHaveBeenCalledWith('/teamname/channels/channelName');
    });

    test('should have called props.onExited on Cancel', async () => {
        const onExited = jest.fn();
        renderWithContext(
            <DeletePostModal
                {...baseProps}
                onExited={onExited}
            />,
        );

        // Close modal to trigger onExited
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        await waitFor(() => {
            expect(onExited).toHaveBeenCalledTimes(1);
        });
    });

    test('should warn about remote post deletion', () => {
        const props = {
            ...baseProps,
            post: {
                ...post,
                remote_id: 'remoteclusterid1',
            },
        };

        renderWithContext(
            <DeletePostModal {...props}/>,
        );

        expect(screen.getByText('Shared Channel')).toBeInTheDocument();
        expect(screen.getByText(/This message originated from a shared channel/)).toBeInTheDocument();
    });
});
