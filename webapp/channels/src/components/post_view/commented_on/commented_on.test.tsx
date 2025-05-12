// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import CommentedOn from 'components/post_view/commented_on/commented_on';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/post_view/CommentedOn', () => {
    const user1 = TestHelper.getUserMock({
        id: 'user1',
    });
    const post1 = TestHelper.getPostMock({
        id: 'post1',
        user_id: user1.id,
        message: 'text message',
    });

    test("should render the root post's message and author", () => {
        renderWithContext(
            <CommentedOn rootId={post1.id}/>,
            {
                entities: {
                    posts: {
                        posts: {
                            post1,
                        },
                    },
                    users: {
                        profiles: {
                            user1,
                        },
                    },
                },
            },
        );

        expect(screen.getByText(textInChildren("Commented on some-user's message: text message"))).toBeInTheDocument();
    });

    test("should render a placeholder name when the post's author isn't loaded", () => {
        renderWithContext(
            <CommentedOn rootId={post1.id}/>,
            {
                entities: {
                    posts: {
                        posts: {
                            post1,
                        },
                    },
                },
            },
        );

        expect(screen.getByText(textInChildren("Commented on Someone's message: text message"))).toBeInTheDocument();
    });

    test("should render a placeholder when the post isn't loaded", () => {
        renderWithContext(
            <CommentedOn rootId={post1.id}/>,
        );

        expect(screen.getByText(textInChildren("Commented on Someone's message: Loading…"))).toBeInTheDocument();
    });

    test("should render the root post's file attachments when it has no message", () => {
        const file1 = TestHelper.getFileInfoMock({id: 'file1', create_at: 1000, name: 'image.png'});
        const file2 = TestHelper.getFileInfoMock({id: 'file2', create_at: 1001, name: 'contract.doc'});

        renderWithContext(
            <CommentedOn rootId={post1.id}/>,
            {
                entities: {
                    files: {
                        fileIdsByPostId: {
                            post1: [file1.id, file2.id],
                        },
                        files: {
                            file1,
                            file2,
                        },
                    },
                    posts: {
                        posts: {
                            [post1.id]: {
                                ...post1,
                                message: '',
                                file_ids: [file1.id, file2.id],
                            },
                        },
                    },
                    users: {
                        profiles: {
                            user1,
                        },
                    },
                },
            },
        );

        expect(screen.getByText(textInChildren("Commented on some-user's message: image.png plus 1 other file"))).toBeInTheDocument();
    });

    test("should render the root post's props.pretext as message", () => {
        renderWithContext(
            <CommentedOn rootId={post1.id}/>,
            {
                entities: {
                    general: {
                        config: {
                            EnablePostUsernameOverride: 'true',
                        },
                    },
                    posts: {
                        posts: {
                            [post1.id]: {
                                ...post1,
                                message: '',
                                props: {
                                    from_webhook: 'true',
                                    override_username: 'override_username',
                                    attachments: [{
                                        pretext: 'This is a pretext',
                                    }],
                                },
                            },
                        },
                    },
                    users: {
                        profiles: {
                            user1,
                        },
                    },
                },
            },
        );

        // This incorrectly uses the post author's name due to MM-63564
        expect(screen.getByText(textInChildren("Commented on some-user's message: This is a pretext"))).toBeInTheDocument();
    });

    test("should render the root post's props.title as message", () => {
        renderWithContext(
            <CommentedOn rootId={post1.id}/>,
            {
                entities: {
                    general: {
                        config: {
                            EnablePostUsernameOverride: 'true',
                        },
                    },
                    posts: {
                        posts: {
                            [post1.id]: {
                                ...post1,
                                message: '',
                                props: {
                                    from_webhook: 'true',
                                    override_username: 'override_username',
                                    attachments: [{
                                        title: 'This is a title',
                                    }],
                                },
                            },
                        },
                    },
                    users: {
                        profiles: {
                            user1,
                        },
                    },
                },
            },
        );

        // This incorrectly uses the post author's name due to MM-63564
        expect(screen.getByText(textInChildren("Commented on some-user's message: This is a title"))).toBeInTheDocument();
    });

    test("should render the root post's props.text as message", () => {
        renderWithContext(
            <CommentedOn rootId={post1.id}/>,
            {
                entities: {
                    general: {
                        config: {
                            EnablePostUsernameOverride: 'true',
                        },
                    },
                    posts: {
                        posts: {
                            [post1.id]: {
                                ...post1,
                                message: '',
                                props: {
                                    from_webhook: 'true',
                                    override_username: 'override_username',
                                    attachments: [{
                                        text: 'This is a text',
                                    }],
                                },
                            },
                        },
                    },
                    users: {
                        profiles: {
                            user1,
                        },
                    },
                },
            },
        );

        // This incorrectly uses the post author's name due to MM-63564
        expect(screen.getByText(textInChildren("Commented on some-user's message: This is a text"))).toBeInTheDocument();
    });

    test("should render the root post's props.fallback as message", () => {
        renderWithContext(
            <CommentedOn rootId={post1.id}/>,
            {
                entities: {
                    general: {
                        config: {
                            EnablePostUsernameOverride: 'true',
                        },
                    },
                    posts: {
                        posts: {
                            [post1.id]: {
                                ...post1,
                                message: '',
                                props: {
                                    from_webhook: 'true',
                                    override_username: 'override_username',
                                    attachments: [{
                                        fallback: 'This is fallback message',
                                    }],
                                },
                            },
                        },
                    },
                    users: {
                        profiles: {
                            user1,
                        },
                    },
                },
            },
        );

        // This incorrectly uses the post author's name due to MM-63564
        expect(screen.getByText(textInChildren("Commented on some-user's message: This is fallback message"))).toBeInTheDocument();
    });

    test('should call onCommentClick on click of text message', () => {
        const onCommentClick = jest.fn();
        renderWithContext(
            <CommentedOn
                onCommentClick={onCommentClick}
                rootId={post1.id}
            />,
            {
                entities: {
                    posts: {
                        posts: {
                            post1,
                        },
                    },
                    users: {
                        profiles: {
                            user1,
                        },
                    },
                },
            },
        );

        screen.getByText('text message').click();

        expect(onCommentClick).toHaveBeenCalledTimes(1);
    });

    test("should render the root post's overwritten username", () => {
        const webhookPost = TestHelper.getPostMock({
            id: 'webhook_post_id',
            user_id: user1.id,
            message: 'text message',
            props: {
                from_webhook: 'true',
                override_username: 'overridden_username',
            },
        });

        const post1 = TestHelper.getPostMock({
            id: 'post1',
            user_id: user1.id,
            message: 'text message',
            root_id: webhookPost.id,
        });

        renderWithContext(
            <CommentedOn
                rootId={webhookPost.id}
                enablePostUsernameOverride={true}
            />,
            {
                entities: {
                    posts: {
                        posts: {
                            post1,
                            webhook_post_id: webhookPost,
                        },
                    },
                    users: {
                        profiles: {
                            user1,
                        },
                    },
                },
            },
        );

        expect(screen.getByText(textInChildren("Commented on overridden_username's message: text message"))).toBeInTheDocument();
    });

    test("should not render the root post's overwritten username if post is not from webhook", () => {
        const webhookPost = TestHelper.getPostMock({
            id: 'webhook_post_id',
            user_id: user1.id,
            message: 'text message',
            props: {
                override_username: 'overridden_username',
            },
        });

        const post1 = TestHelper.getPostMock({
            id: 'post1',
            user_id: user1.id,
            message: 'text message',
            root_id: webhookPost.id,
        });

        renderWithContext(
            <CommentedOn
                rootId={webhookPost.id}
                enablePostUsernameOverride={true}
            />,
            {
                entities: {
                    posts: {
                        posts: {
                            post1,
                            webhook_post_id: webhookPost,
                        },
                    },
                    users: {
                        profiles: {
                            user1,
                        },
                    },
                },
            },
        );

        expect(screen.getByText(textInChildren("Commented on some-user's message: text message"))).toBeInTheDocument();
    });
});

function textInChildren(matchedText: string) {
    return (content: string, element: Element | null) => {
        const hasText = element?.textContent === matchedText;
        const childHasText = element && Array.from(element?.children).some((child) => child?.textContent === matchedText);
        return hasText && !childHasText;
    };
}
