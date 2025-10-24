// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {lazy} from 'react';
import {FormattedMessage} from 'react-intl';
import type {RouteComponentProps} from 'react-router-dom';

import {makeAsyncComponent} from 'components/async_load';
import {DropOverlayIdCenterChannel} from 'components/file_upload_overlay/file_upload_overlay';

import WebSocketClient from 'client/web_websocket_client';

import InputLoading from './input_loading';

import type {PropsFromRedux} from './index';
import type {TabType} from '../channel_tabs';

const ChannelHeader = makeAsyncComponent('ChannelHeader', lazy(() => import('components/channel_header')));
const FileUploadOverlay = makeAsyncComponent('FileUploadOverlay', lazy(() => import('components/file_upload_overlay')));
const ChannelTabs = makeAsyncComponent('ChannelTabs', lazy(() => import('components/channel_tabs')));
const ChannelTabContent = makeAsyncComponent('ChannelTabContent', lazy(() => import('components/channel_tabs/channel_tab_panel')));
const AdvancedCreatePost = makeAsyncComponent('AdvancedCreatePost', lazy(() => import('components/advanced_create_post')));
const ChannelBanner = makeAsyncComponent('ChannelBanner', lazy(() => import('components/channel_banner/channel_banner')));

export type Props = PropsFromRedux & RouteComponentProps<{
    postid?: string;
}>;

type State = {
    channelId: string;
    url: string;
    focusedPostId?: string;
    waitForLoader: boolean;
    activeTab: TabType;
};

export default class ChannelViewWithTabs extends React.PureComponent<Props, State> {
    channelViewRef: React.RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);

        this.state = {
            url: props.match?.url || '',
            channelId: props.channelId,
            focusedPostId: props.match?.params?.postid,
            waitForLoader: false,
            activeTab: 'messages',
        };

        this.channelViewRef = React.createRef();
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        let updatedState = {};
        const focusedPostId = props.match?.params?.postid;

        if (props.match?.url !== state.url && props.channelId !== state.channelId) {
            updatedState = {url: props.match?.url || '', focusedPostId};
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

    onClickCloseChannel = () => {
        this.props.goToLastViewedChannel();
    };

    onUpdateInputShowLoader = (v: boolean) => {
        this.setState({waitForLoader: v});
    };

    onTabChange = (tab: TabType) => {
        this.setState({activeTab: tab});
    };

    componentDidUpdate(prevProps: Props) {
        // TODO: debounce
        if (prevProps.channelId !== this.props.channelId && this.props.enableWebSocketEventScope) {
            WebSocketClient.updateActiveChannel(this.props.channelId);
        }

        // Reset to messages tab when switching channels
        if (prevProps.channelId !== this.props.channelId) {
            this.setState({activeTab: 'messages'});
        }

        // If we're restricting direct messages and the value is not yet set, fetch it
        if (this.props.canRestrictDirectMessage && this.props.restrictDirectMessage === undefined) {
            this.props.fetchIsRestrictedDM(this.props.channelId);
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
                                b: (chunks) => <b>{chunks}</b>,
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
                                b: (chunks) => <b>{chunks}</b>,
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
        } else if (this.props.restrictDirectMessage) {
            createPost = (
                <div
                    className='post-create__container'
                    id='post-create'
                >
                    <div
                        id='noSharedTeamMessage'
                        className='channel-archived__message'
                    >
                        <FormattedMessage
                            id='channelView.noSharedTeam'
                            defaultMessage='You no longer have any teams in common with this user. New messages cannot be posted.'
                            values={{
                                b: (chunks) => <b>{chunks}</b>,
                            }}
                        />
                        <button
                            className='btn btn-primary channel-archived__close-btn'
                            onClick={this.onClickCloseChannel}
                        >
                            <FormattedMessage
                                id='center_panel.noSharedTeam.closeChannel'
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
                <ChannelHeader/>
                <ChannelTabs
                    activeTab={this.state.activeTab}
                    onTabChange={this.onTabChange}
                    channelId={this.props.channelId}
                    isChannelBookmarksEnabled={this.props.isChannelBookmarksEnabled}
                />
                <ChannelBanner channelId={this.props.channelId}/>
                <ChannelTabContent
                    channelId={this.props.channelId}
                    activeTab={this.state.activeTab}
                    focusedPostId={this.state.focusedPostId}
                    createPost={createPost}
                />
            </div>
        );
    }
}
