// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import UserProfile from './user_profile.jsx';

import UserStore from 'stores/user_store.jsx';

import * as GlobalActions from 'action_creators/global_actions.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import * as TextFormatting from 'utils/text_formatting.jsx';
import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import {FormattedMessage, FormattedDate} from 'react-intl';
import React from 'react';
import {browserHistory} from 'react-router';

export default class SearchResultsItem extends React.Component {
    constructor(props) {
        super(props);

        this.handleFocusRHSClick = this.handleFocusRHSClick.bind(this);
    }

    hideSidebar() {
        $('.inner-wrap, .sidebar--right').removeClass('move--left');
    }

    handleFocusRHSClick(e) {
        e.preventDefault();
        GlobalActions.emitPostFocusRightHandSideFromSearch(this.props.post, this.props.isMentionSearch);
    }

    render() {
        let channelName = null;
        const channel = this.props.channel;
        const timestamp = UserStore.getCurrentUser().update_at;
        const user = this.props.user || {};
        const post = this.props.post;

        if (channel) {
            channelName = channel.display_name;
            if (channel.type === 'D') {
                channelName = (
                    <FormattedMessage
                        id='search_item.direct'
                        defaultMessage='Direct Message'
                    />
                );
            }
        }

        const formattingOptions = {
            searchTerm: this.props.term,
            mentionHighlight: this.props.isMentionSearch
        };

        let overrideUsername;
        let disableProfilePopover = false;
        if (post.props &&
                post.props.from_webhook &&
                post.props.override_username &&
                global.window.mm_config.EnablePostUsernameOverride === 'true') {
            overrideUsername = post.props.override_username;
            disableProfilePopover = true;
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
                    className='post'
                >
                    <div className='search-channel__name'>{channelName}</div>
                    <div className='post__content'>
                        <div className='post__img'>
                            <img
                                src={PostUtils.getProfilePicSrcForPost(post, timestamp)}
                                height='36'
                                width='36'
                            />
                        </div>
                        <div>
                            <ul className='post__header'>
                                <li className='col__name'><strong>
                                    <UserProfile
                                        user={user}
                                        overwriteName={overrideUsername}
                                        disablePopover={disableProfilePopover}
                                    />
                                </strong></li>
                                <li className='col'>
                                    <time className='search-item-time'>
                                        <FormattedDate
                                            value={post.create_at}
                                            hour12={!Utils.isMilitaryTime()}
                                            hour='2-digit'
                                            minute='2-digit'
                                        />
                                    </time>
                                </li>
                                <li>
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
                                                browserHistory.push('/' + window.location.pathname.split('/')[1] + '/pl/' + post.id);
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
                                <li>
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
                                </li>
                            </ul>
                            <div className='search-item-snippet'>
                                <span
                                    onClick={TextFormatting.handleClick}
                                    dangerouslySetInnerHTML={{__html: TextFormatting.formatText(post.message, formattingOptions)}}
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
    isMentionSearch: React.PropTypes.bool,
    term: React.PropTypes.string
};
