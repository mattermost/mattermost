// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostMessageContainer from 'components/post_view/post_message_view';
import UserProfile from './user_profile.jsx';
import FileAttachmentListContainer from 'components/file_attachment_list';
import ProfilePicture from './profile_picture.jsx';
import CommentIcon from 'components/common/comment_icon.jsx';
import DotMenu from 'components/dot_menu';
import PostFlagIcon from 'components/post_view/post_flag_icon.jsx';

import TeamStore from 'stores/team_store.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import Constants from 'utils/constants.jsx';

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage, FormattedDate} from 'react-intl';
import {browserHistory, Link} from 'react-router/es6';

export default class SearchResultsItem extends React.Component {
    constructor(props) {
        super(props);

        this.handleFocusRHSClick = this.handleFocusRHSClick.bind(this);
        this.handleJumpClick = this.handleJumpClick.bind(this);
        this.handleDropdownOpened = this.handleDropdownOpened.bind(this);
        this.shrinkSidebar = this.shrinkSidebar.bind(this);

        this.state = {
            currentTeamDisplayName: TeamStore.getCurrent().name,
            width: '',
            height: '',
            dropdownOpened: false
        };
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextState.post, this.props.post)) {
            return true;
        }

        if (nextProps.isFlagged !== this.props.isFlagged) {
            return true;
        }

        if (nextState.dropdownOpened !== this.state.dropdownOpened) {
            return true;
        }

        return false;
    }

    componentDidMount() {
        window.addEventListener('resize', () => {
            Utils.updateWindowDimensions(this);
        });
    }

    componentWillUnmount() {
        window.removeEventListener('resize', () => {
            Utils.updateWindowDimensions(this);
        });
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

    handleJumpClick() {
        if (Utils.isMobile()) {
            GlobalActions.toggleSideBarAction(false);
        }

        this.shrinkSidebar();
        browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/pl/' + this.props.post.id);
    }

    handleDropdownOpened = (isOpened) => {
        this.setState({
            dropdownOpened: isOpened
        });
    }

    timeTag(post) {
        return (
            <time
                className='search-item-time'
                dateTime={Utils.getDateForUnixTicks(post.create_at).toISOString()}
            >
                <FormattedDate
                    value={post.create_at}
                    hour12={!this.props.useMilitaryTime}
                    hour='2-digit'
                    minute='2-digit'
                />
            </time>
        );
    }

    renderTimeTag(post) {
        return Utils.isMobile() ?
            this.timeTag(post) :
            (
                <Link
                    to={`/${this.state.currentTeamDisplayName}/pl/${post.id}`}
                    target='_blank'
                    className='post__permalink'
                >
                    {this.timeTag(post)}
                </Link>
            );
    }

    getClassName = () => {
        let className = 'post post--thread';

        if (this.props.compactDisplay) {
            className += ' post--compact';
        }

        if (this.state.dropdownOpened) {
            className += ' post--hovered';
        }

        return className;
    }

    render() {
        let channelName = null;
        const channel = this.props.channel;
        const user = this.props.user || {};
        const post = this.props.post;

        let idCount = -1;
        if (this.props.lastPostCount >= 0 && this.props.lastPostCount < Constants.TEST_ID_COUNT) {
            idCount = this.props.lastPostCount;
        }

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
            botIndicator = <div className='bot-indicator'>{Constants.BOT_NAME}</div>;
        }

        const profilePic = (
            <ProfilePicture
                src={PostUtils.getProfilePicSrcForPost(post, user)}
                user={this.props.user}
                status={this.props.status}
                isBusy={this.props.isBusy}
            />

        );

        const profilePicContainer = (<div className='post__img'>{profilePic}</div>);

        let postClass = '';
        if (PostUtils.isEdited(this.props.post)) {
            postClass += ' post--edited';
        }

        let fileAttachment = null;
        if (post.file_ids && post.file_ids.length > 0) {
            fileAttachment = (
                <FileAttachmentListContainer
                    post={post}
                    compactDisplay={this.props.compactDisplay}
                />
            );
        }

        let message;
        let flagContent;
        let rhsControls;
        if (post.state === Constants.POST_DELETED) {
            message = (
                <p>
                    <FormattedMessage
                        id='post_body.deleted'
                        defaultMessage='(message deleted)'
                    />
                </p>
            );
        } else {
            flagContent = (
                <PostFlagIcon
                    idPrefix={'searchPostFlag'}
                    idCount={idCount}
                    postId={post.id}
                    isFlagged={this.props.isFlagged}
                />
            );

            rhsControls = (
                <div className='col__controls'>
                    <DotMenu
                        idPrefix={Constants.SEARCH_POST}
                        idCount={idCount}
                        post={post}
                        isFlagged={this.props.isFlagged}
                        handleDropdownOpened={this.handleDropdownOpened}
                    />
                    <CommentIcon
                        idPrefix={'searchCommentIcon'}
                        idCount={idCount}
                        handleCommentClick={this.handleFocusRHSClick}
                        searchStyle={'search-item__comment'}
                    />
                    <a
                        onClick={this.handleJumpClick}
                        className='search-item__jump'
                    >
                        <FormattedMessage
                            id='search_item.jump'
                            defaultMessage='Jump'
                        />
                    </a>
                </div>
            );

            message = (
                <PostMessageContainer
                    post={post}
                    options={{
                        searchTerm: this.props.term,
                        mentionHighlight: this.props.isMentionSearch
                    }}
                />
            );
        }

        let pinnedBadge;
        if (post.is_pinned) {
            pinnedBadge = (
                <span className='post__pinned-badge'>
                    <FormattedMessage
                        id='post_info.pinned'
                        defaultMessage='Pinned'
                    />
                </span>
            );
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
                <div className={this.getClassName()}>
                    <div className='search-channel__name'>{channelName}</div>
                    <div className='post__content'>
                        {profilePicContainer}
                        <div>
                            <div className='post__header'>
                                <div className='col col__name'>
                                    <strong>
                                        <UserProfile
                                            user={user}
                                            overwriteName={overrideUsername}
                                            disablePopover={disableProfilePopover}
                                            status={this.props.status}
                                            isBusy={this.props.isBusy}
                                        />
                                    </strong>
                                </div>
                                {botIndicator}
                                <div className='col'>
                                    {this.renderTimeTag(post)}
                                    {pinnedBadge}
                                    {flagContent}
                                </div>
                                {rhsControls}
                            </div>
                            <div className='search-item-snippet post__body'>
                                <div className={postClass}>
                                    {message}
                                    {fileAttachment}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

SearchResultsItem.propTypes = {
    post: PropTypes.object,
    lastPostCount: PropTypes.number,
    user: PropTypes.object,
    channel: PropTypes.object,
    compactDisplay: PropTypes.bool,
    isMentionSearch: PropTypes.bool,
    isFlaggedSearch: PropTypes.bool,
    term: PropTypes.string,
    useMilitaryTime: PropTypes.bool.isRequired,
    shrink: PropTypes.func,
    isFlagged: PropTypes.bool,
    isBusy: PropTypes.bool,
    status: PropTypes.string
};
