// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import type {RouteComponentProps} from 'react-router-dom';

import AdvancedCreatePost from 'components/advanced_create_post';
import ChannelHeader from 'components/channel_header';
import deferComponentRender from 'components/deferComponentRender';
import FileUploadOverlay from 'components/file_upload_overlay';
import PostView from 'components/post_view';

import WebSocketClient from 'client/web_websocket_client';

import type {PropsFromRedux} from './index';

export type Props = PropsFromRedux & RouteComponentProps<{
    postid?: string;
}>;

type State = {
    channelId: string;
    url: string;
    focusedPostId?: string;
    deferredPostView: any;
};

export default class ChannelView extends React.PureComponent<Props, State> {
    public static createDeferredPostView = () => {
        return deferComponentRender(
            PostView,
            <div
                id='post-list'
                className='a11y__region'
                data-a11y-sort-order='1'
                data-a11y-focus-child={true}
                data-a11y-order-reversed={true}
            />,
        );
    };

    static getDerivedStateFromProps(props: Props, state: State) {
        let updatedState = {};
        const focusedPostId = props.match.params.postid;

        if (props.match.url !== state.url && props.channelId !== state.channelId) {
            updatedState = {deferredPostView: ChannelView.createDeferredPostView(), url: props.match.url, focusedPostId};
        }

        if (props.channelId !== state.channelId) {
            updatedState = {...updatedState, channelId: props.channelId, focusedPostId};
        }

        if (focusedPostId && focusedPostId !== state.focusedPostId) {
            updatedState = {...updatedState, focusedPostId};
        }

        if (Object.keys(updatedState).length) {
            return updatedState;
        }

        return null;
    }

    channelViewRef: React.RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);

        this.state = {
            url: props.match.url,
            channelId: props.channelId,
            focusedPostId: props.match.params.postid,
            deferredPostView: ChannelView.createDeferredPostView(),
        };

        this.channelViewRef = React.createRef();
    }

    getChannelView = () => {
        return this.channelViewRef.current;
    };

    onClickCloseChannel = () => {
        this.props.goToLastViewedChannel();
    };

    componentDidUpdate(prevProps: Props) {
        // TODO: debounce
        if (prevProps.channelId !== this.props.channelId && this.props.enableWebSocketEventScope) {
            WebSocketClient.updateActiveChannel(this.props.channelId);
        }
        if (prevProps.channelId !== this.props.channelId || prevProps.channelIsArchived !== this.props.channelIsArchived) {
            if (this.props.channelIsArchived && !this.props.viewArchivedChannels) {
                this.props.goToLastViewedChannel();
            }
        }
    }

    render() {
        let createPost;
        if (this.props.deactivatedChannel) {
            createPost = (
                <div
                    className='post-create__container'
                    id='post-create'
                >
                    <div
                        className='channel-archived__message'
                    >
                        <FormattedMessage
                            id='create_post.deactivated'
                            defaultMessage='You are viewing an archived channel with a <strong>deactivated user</strong>. New messages cannot be posted.'
                            values={{
                                strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
                            }}
                        />
                        <button
                            className='btn btn-primary channel-archived__close-btn'
                            onClick={this.onClickCloseChannel}
                        >
                            <FormattedMessage
                                id='center_panel.archived.closeChannel'
                                defaultMessage='Close Channel'
                            />
                        </button>
                    </div>
                </div>
            );
        } else if (this.props.channelIsArchived) {
            createPost = (
                <div
                    className='post-create__container'
                    id='post-create'
                >
                    <div
                        id='channelArchivedMessage'
                        className='channel-archived__message'
                    >
                        <FormattedMessage
                            id='archivedChannelMessage'
                            defaultMessage='You are viewing an <strong>archived channel</strong>. New messages cannot be posted.'
                            values={{
                                strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
                            }}
                        />
                        <button
                            className='btn btn-primary channel-archived__close-btn'
                            onClick={this.onClickCloseChannel}
                        >
                            <FormattedMessage
                                id='center_panel.archived.closeChannel'
                                defaultMessage='Close Channel'
                            />
                        </button>
                    </div>
                </div>
            );
        } else {
            createPost = (
                <div
                    id='post-create'
                    data-testid='post-create'
                    className='post-create__container AdvancedTextEditor__ctr'
                >
                    <AdvancedCreatePost getChannelView={this.getChannelView}/>
                </div>
            );
        }

        const DeferredPostView = this.state.deferredPostView;

        return (
            <div
                ref={this.channelViewRef}
                id='app-content'
                className='app__content'
            >
                <FileUploadOverlay overlayType='center'/>
                <ChannelHeader
                    {...this.props}
                />
                <DeferredPostView
                    channelId={this.props.channelId}
                    focusedPostId={this.state.focusedPostId}
                />
                {createPost}
            </div>
        );
    }
}
