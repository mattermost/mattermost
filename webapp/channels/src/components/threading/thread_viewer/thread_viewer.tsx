// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {HTMLAttributes} from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UserThread} from '@mattermost/types/threads';

import type {ActionResult} from 'mattermost-redux/types/actions';

import deferComponentRender from 'components/deferComponentRender';
import FileUploadOverlay from 'components/file_upload_overlay';
import {DropOverlayIdThreads} from 'components/file_upload_overlay/file_upload_overlay';
import LoadingScreen from 'components/loading_screen';

import WebSocketClient from 'client/web_websocket_client';

import type {FakePost} from 'types/store/rhs';

import ThreadViewerVirtualized from '../virtualized_thread_viewer';

import './thread_viewer.scss';

const DeferredThreadViewerVirt = deferComponentRender(ThreadViewerVirtualized);

type Attrs = Pick<HTMLAttributes<HTMLDivElement>, 'className' | 'id'>;

export type Props = Attrs & {
    isCollapsedThreadsEnabled: boolean;
    appsEnabled: boolean;
    userThread?: UserThread | null;
    channel?: Channel;
    selected?: Post | FakePost;
    currentUserId: string;
    currentTeamId: string;
    socketConnectionStatus: boolean;
    actions: {
        fetchRHSAppsBindings: (channelId: string, rootID: string) => unknown;
        getNewestPostThread: (rootId: string) => Promise<ActionResult>;
        getPostThread: (rootId: string, fetchThreads: boolean) => Promise<ActionResult>;
        getThread: (userId: string, teamId: string, threadId: string, extended: boolean) => Promise<ActionResult>;
        selectPostCard: (post: Post) => void;
        updateThreadLastOpened: (threadId: string, lastViewedAt: number) => unknown;
        updateThreadRead: (userId: string, teamId: string, threadId: string, timestamp: number) => unknown;
    };
    useRelativeTimestamp?: boolean;
    postIds: string[];
    highlightedPostId?: Post['id'];
    selectedPostFocusedAt?: number;
    isThreadView: boolean;
    inputPlaceholder?: string;
    rootPostId: string;
    enableWebSocketEventScope: boolean;
};

type State = {
    isLoading: boolean;
}

export default class ThreadViewer extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);

        this.state = {
            isLoading: false,
        };
    }

    public componentDidMount() {
        if (this.props.isCollapsedThreadsEnabled && this.props.userThread !== null) {
            this.markThreadRead();
        }

        this.onInit();

        if (this.props.appsEnabled) {
            this.props.actions.fetchRHSAppsBindings(this.props.channel?.id || '', this.props.selected?.id || this.props.rootPostId);
        }
    }

    public componentWillUnmount() {
        if (this.props.enableWebSocketEventScope) {
            WebSocketClient.updateActiveThread(this.props.isThreadView, '');
        }
    }

    public componentDidUpdate(prevProps: Props) {
        const reconnected = this.props.socketConnectionStatus && !prevProps.socketConnectionStatus;

        if (!this.props.selected) {
            return;
        }

        const selectedChanged = this.props.selected.id !== prevProps.selected?.id;

        if (reconnected || selectedChanged) {
            this.onInit(reconnected);
        }

        if (
            this.props.isCollapsedThreadsEnabled &&
            this.props.userThread?.id !== prevProps.userThread?.id
        ) {
            this.markThreadRead();
        }

        if (this.props.appsEnabled && (
            this.props.channel?.id !== prevProps.channel?.id || this.props.selected.id !== prevProps.selected?.id
        )) {
            this.props.actions.fetchRHSAppsBindings(this.props.channel?.id || '', this.props.selected.id);
        }
    }

    public morePostsToFetch(): boolean {
        const replyCount = this.getReplyCount();
        return Boolean(this.props.selected) && this.props.postIds.length < (replyCount + 1);
    }

    public getReplyCount(): number {
        return (this.props.selected as Post)?.reply_count || this.props.userThread?.reply_count || 0;
    }

    fetchThread() {
        const {
            actions: {
                getThread,
            },
            currentUserId,
            currentTeamId,
            selected,
        } = this.props;

        if (selected && this.getReplyCount() && (this.props.selected as Post)?.is_following) {
            return getThread(
                currentUserId,
                currentTeamId,
                selected.id,
                true,
            );
        }

        return Promise.resolve({data: true});
    }

    markThreadRead() {
        if (this.props.userThread) {
            // update last viewed at for thread before marking as read.
            this.props.actions.updateThreadLastOpened(
                this.props.userThread.id,
                this.props.userThread.last_viewed_at,
            );

            if (
                this.props.userThread.last_viewed_at < this.props.userThread.last_reply_at ||
                this.props.userThread.unread_mentions ||
                this.props.userThread.unread_replies
            ) {
                this.props.actions.updateThreadRead(
                    this.props.currentUserId,
                    this.props.currentTeamId,
                    this.props.selected?.id || this.props.rootPostId,
                    Date.now(),
                );
            }
        }
    }

    // called either after mount, socket reconnected, or selected thread changed
    // fetches the thread/posts if needed and
    // scrolls to either bottom or new messages line
    private onInit = async (reconnected = false): Promise<void> => {
        this.setState({isLoading: !reconnected});
        await this.props.actions.getPostThread(this.props.selected?.id || this.props.rootPostId, !reconnected);

        if (
            this.props.isCollapsedThreadsEnabled &&
            this.props.userThread == null
        ) {
            await this.fetchThread();
        }

        if (this.props.channel && this.props.enableWebSocketEventScope) {
            WebSocketClient.updateActiveThread(this.props.isThreadView, this.props.channel?.id);
        }
        this.setState({isLoading: false});
    };

    private handleCardClick = (post: Post) => {
        if (!post) {
            return;
        }

        this.props.actions.selectPostCard(post);
    };

    public render(): JSX.Element {
        if (this.props.postIds == null || this.props.selected == null || !this.props.channel) {
            return (
                <span/>
            );
        }

        if (this.state.isLoading && this.props.postIds.length < 2) {
            return (
                <LoadingScreen
                    style={{
                        display: 'grid',
                        placeContent: 'center',
                        flex: '1',
                    }}
                />
            );
        }

        return (
            <>
                <div className={classNames('ThreadViewer', this.props.className)}>
                    <div className='post-right-comments-container'>
                        <>
                            <FileUploadOverlay
                                overlayType='right'
                                id={DropOverlayIdThreads}
                            />
                            {this.props.selected && (
                                <DeferredThreadViewerVirt
                                    inputPlaceholder={this.props.inputPlaceholder}
                                    key={this.props.selected.id}
                                    channelId={this.props.channel.id}
                                    onCardClick={this.handleCardClick}
                                    postIds={this.props.postIds}
                                    selected={this.props.selected}
                                    useRelativeTimestamp={this.props.useRelativeTimestamp || false}
                                    highlightedPostId={this.props.highlightedPostId}
                                    selectedPostFocusedAt={this.props.selectedPostFocusedAt}
                                    isThreadView={Boolean(this.props.isCollapsedThreadsEnabled && this.props.isThreadView)}
                                />
                            )}
                        </>
                    </div>
                </div>
            </>
        );
    }
}
