// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {lazy} from 'react';
import {FormattedMessage} from 'react-intl';
import type {RouteComponentProps} from 'react-router-dom';

import {makeAsyncComponent} from 'components/async_load';
import deferComponentRender from 'components/deferComponentRender';
import {DropOverlayIdCenterChannel} from 'components/file_upload_overlay/file_upload_overlay';
import PostView from 'components/post_view';

import WebSocketClient from 'client/web_websocket_client';

import InputLoading from './input_loading';

import type {PropsFromRedux} from './index';

const ChannelHeader = makeAsyncComponent('ChannelHeader', lazy(() => import('components/channel_header')));
const FileUploadOverlay = makeAsyncComponent('FileUploadOverlay', lazy(() => import('components/file_upload_overlay')));
const ChannelBookmarks = makeAsyncComponent('ChannelBookmarks', lazy(() => import('components/channel_bookmarks')));
const AdvancedCreatePost = makeAsyncComponent('AdvancedCreatePost', lazy(() => import('components/advanced_create_post')));
const ChannelBanner = makeAsyncComponent('ChannelBanner', lazy(() => import('components/channel_banner/channel_banner')));

export type Props = PropsFromRedux & RouteComponentProps<{
    postid?: string;
}>;

type State = {
    channelId: string;
    url: string;
    focusedPostId?: string;
    deferredPostView: any;
    waitForLoader: boolean;
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
            waitForLoader: false,
        };

        this.channelViewRef = React.createRef();
    }

    onClickCloseChannel = () => {
        this.props.goToLastViewedChannel();
    };

    onUpdateInputShowLoader = (v: boolean) => {
        this.setState({waitForLoader: v});
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
                    className='post-create__container AdvancedTextEditor__ctr'
                    id='post-create'
                >
                    <div
                        className='channel-archived__message'
                    >
                        <FormattedMessage
                            id='channelView.archivedChannelWithDeactivatedUser'
                            defaultMessage='You are viewing an archived channel with a <b>deactivated user</b>. New messages cannot be posted.'
                            values={{
                                b: (chunks: string) => <b>{chunks}</b>,
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
                            id='channelView.archivedChannel'
                            defaultMessage='You are viewing an <b>archived channel</b>. New messages cannot be posted.'
                            values={{
                                b: (chunks: string) => <b>{chunks}</b>,
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
        } else if (this.props.missingChannelRole || this.state.waitForLoader) {
            createPost = <InputLoading updateWaitForLoader={this.onUpdateInputShowLoader}/>;
        } else {
            createPost = (
                <div
                    id='post-create'
                    data-testid='post-create'
                    className='post-create__container AdvancedTextEditor__ctr'
                >
                    <AdvancedCreatePost/>
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
                <FileUploadOverlay
                    overlayType='center'
                    id={DropOverlayIdCenterChannel}
                />
                <ChannelHeader {...this.props}/>
                {this.props.isChannelBookmarksEnabled && <ChannelBookmarks channelId={this.props.channelId}/>}
                <ChannelBanner channelId={this.props.channelId}/>
                <DeferredPostView
                    channelId={this.props.channelId}
                    focusedPostId={this.state.focusedPostId}
                />
                {createPost}
            </div>
        );
    }
}
