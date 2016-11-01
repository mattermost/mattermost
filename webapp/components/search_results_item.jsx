// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import PostMessageContainer from 'components/post_view/components/post_message_container.jsx';
import UserProfile from './user_profile.jsx';
import ProfilePicture from './profile_picture.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import {flagPost, unflagPost} from 'actions/post_actions.jsx';

import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';

import Constants from 'utils/constants.jsx';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
const ActionTypes = Constants.ActionTypes;

import React from 'react';
import {FormattedMessage, FormattedDate} from 'react-intl';
import {browserHistory} from 'react-router/es6';

export default class SearchResultsItem extends React.Component {
    constructor(props) {
        super(props);

        this.handleFocusRHSClick = this.handleFocusRHSClick.bind(this);
        this.shrinkSidebar = this.shrinkSidebar.bind(this);
        this.unflagPost = this.unflagPost.bind(this);
        this.flagPost = this.flagPost.bind(this);
    }

    hideSidebar() {
        $('.sidebar--right').removeClass('move--left');
    }

    shrinkSidebar() {
        setTimeout(() => {
            this.props.shrink();
        });
    }

    handleFocusRHSClick(e) {
        e.preventDefault();
        GlobalActions.emitPostFocusRightHandSideFromSearch(this.props.post, this.props.isMentionSearch);
    }

    flagPost(e) {
        e.preventDefault();
        flagPost(this.props.post.id);
    }

    unflagPost(e) {
        e.preventDefault();
        unflagPost(this.props.post.id);
    }

    render() {
        let channelName = null;
        const channel = this.props.channel;
        const timestamp = UserStore.getCurrentUser().update_at;
        const user = this.props.user || {};
        const post = this.props.post;
        const flagIcon = Constants.FLAG_ICON_SVG;

        if (channel) {
            channelName = channel.display_name;
            if (channel.type === 'D') {
                channelName = (
                    <FormattedMessage
                        id='search_item.direct'
                        defaultMessage='Direct Message (with {username})'
                        values={{
                            username: Utils.displayUsernameForUser(Utils.getDirectTeammate(channel.id))
                        }}
                    />
                );
            }
        }

        let overrideUsername;
        let disableProfilePopover = false;
        if (post.props &&
                post.props.from_webhook &&
                post.props.override_username &&
                global.window.mm_config.EnablePostUsernameOverride === 'true') {
            overrideUsername = post.props.override_username;
            disableProfilePopover = true;
        }

        let botIndicator;
        if (post.props && post.props.from_webhook) {
            botIndicator = <li className='bot-indicator'>{Constants.BOT_NAME}</li>;
        }

        const profilePic = (
            <ProfilePicture
                src={PostUtils.getProfilePicSrcForPost(post, timestamp)}
                user={this.props.user}
            />

        );

        let compactClass = '';
        const profilePicContainer = (<div className='post__img'>{profilePic}</div>);
        if (this.props.compactDisplay) {
            compactClass = 'post--compact';
        }

        let flag;
        let flagFunc;
        let flagVisible = '';
        let flagTooltip = (
            <Tooltip id='flagTooltip'>
                <FormattedMessage
                    id='flag_post.flag'
                    defaultMessage='Flag for follow up'
                />
            </Tooltip>
        );
        if (this.props.isFlagged) {
            flagVisible = 'visible';
            flagTooltip = (
                <Tooltip id='flagTooltip'>
                    <FormattedMessage
                        id='flag_post.unflag'
                        defaultMessage='Unflag'
                    />
                </Tooltip>
            );
            flagFunc = this.unflagPost;
            flag = (
                <span
                    className='icon'
                    dangerouslySetInnerHTML={{__html: flagIcon}}
                />
            );
        } else {
            flag = (
                <span
                    className='icon'
                    dangerouslySetInnerHTML={{__html: flagIcon}}
                />
            );
            flagFunc = this.flagPost;
        }

        return (
            <div className='search-item__container'>
                <div className='date-separator'>
                    <hr className='separator__hr'/>
                    <div className='separator__text'>
                        <FormattedDate
                            value={post.create_at}
                            day='numeric'
                            month='long'
                            year='numeric'
                        />
                    </div>
                </div>
                <div
                    className={'post post--thread ' + compactClass}
                >
                    <div className='search-channel__name'>{channelName}</div>
                    <div className='post__content'>
                        {profilePicContainer}
                        <div>
                            <ul className='post__header'>
                                <li className='col col__name'><strong>
                                    <UserProfile
                                        user={user}
                                        overwriteName={overrideUsername}
                                        disablePopover={disableProfilePopover}
                                    />
                                </strong></li>
                                {botIndicator}
                                <li className='col'>
                                    <time className='search-item-time'>
                                        <FormattedDate
                                            value={post.create_at}
                                            hour12={!this.props.useMilitaryTime}
                                            hour='2-digit'
                                            minute='2-digit'
                                        />
                                    </time>
                                    <OverlayTrigger
                                        delayShow={Constants.OVERLAY_TIME_DELAY}
                                        placement='top'
                                        overlay={flagTooltip}
                                    >
                                        <a
                                            href='#'
                                            className={'flag-icon__container ' + flagVisible}
                                            onClick={flagFunc}
                                        >
                                            {flag}
                                        </a>
                                    </OverlayTrigger>
                                </li>
                                <li className='col__controls'>
                                    <a
                                        href='#'
                                        className='comment-icon__container search-item__comment'
                                        onClick={this.handleFocusRHSClick}
                                    >
                                        <span
                                            className='comment-icon'
                                            dangerouslySetInnerHTML={{__html: Constants.REPLY_ICON}}
                                        />
                                    </a>
                                    <a
                                        onClick={
                                            () => {
                                                if (Utils.isMobile()) {
                                                    AppDispatcher.handleServerAction({
                                                        type: ActionTypes.RECEIVED_SEARCH,
                                                        results: null
                                                    });

                                                    AppDispatcher.handleServerAction({
                                                        type: ActionTypes.RECEIVED_SEARCH_TERM,
                                                        term: null,
                                                        do_search: false,
                                                        is_mention_search: false
                                                    });

                                                    AppDispatcher.handleServerAction({
                                                        type: ActionTypes.RECEIVED_POST_SELECTED,
                                                        postId: null
                                                    });

                                                    this.hideSidebar();
                                                }
                                                this.shrinkSidebar();
                                                browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/pl/' + post.id);
                                            }
                                        }
                                        className='search-item__jump'
                                    >
                                        <FormattedMessage
                                            id='search_item.jump'
                                            defaultMessage='Jump'
                                        />
                                    </a>
                                </li>
                            </ul>
                            <div className='search-item-snippet'>
                                <PostMessageContainer
                                    post={post}
                                    options={{
                                        searchTerm: this.props.term,
                                        mentionHighlight: this.props.isMentionSearch
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

SearchResultsItem.propTypes = {
    post: React.PropTypes.object,
    user: React.PropTypes.object,
    channel: React.PropTypes.object,
    compactDisplay: React.PropTypes.bool,
    isMentionSearch: React.PropTypes.bool,
    isFlaggedSearch: React.PropTypes.bool,
    term: React.PropTypes.string,
    useMilitaryTime: React.PropTypes.bool.isRequired,
    shrink: React.PropTypes.function,
    isFlagged: React.PropTypes.bool
};
