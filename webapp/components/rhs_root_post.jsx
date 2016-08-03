// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserProfile from './user_profile.jsx';
import PostBodyAdditionalContent from 'components/post_view/components/post_body_additional_content.jsx';
import FileAttachmentList from './file_attachment_list.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import {flagPost, unflagPost} from 'actions/post_actions.jsx';

import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import * as TextFormatting from 'utils/text_formatting.jsx';

import Constants from 'utils/constants.jsx';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {FormattedMessage, FormattedDate} from 'react-intl';

import React from 'react';

export default class RhsRootPost extends React.Component {
    constructor(props) {
        super(props);

        this.handlePermalink = this.handlePermalink.bind(this);
        this.flagPost = this.flagPost.bind(this);
        this.unflagPost = this.unflagPost.bind(this);

        this.state = {};
    }

    handlePermalink(e) {
        e.preventDefault();
        GlobalActions.showGetPostLinkModal(this.props.post);
    }

    shouldComponentUpdate(nextProps) {
        if (nextProps.compactDisplay !== this.props.compactDisplay) {
            return true;
        }

        if (nextProps.useMilitaryTime !== this.props.useMilitaryTime) {
            return true;
        }

        if (nextProps.isFlagged !== this.props.isFlagged) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.post, this.props.post)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.currentUser, this.props.currentUser)) {
            return true;
        }

        return false;
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
        const post = this.props.post;
        const user = this.props.user;
        const mattermostLogo = Constants.MATTERMOST_ICON_SVG;
        var isOwner = this.props.currentUser.id === post.user_id;
        var isAdmin = TeamStore.isTeamAdminForCurrentTeam() || UserStore.isSystemAdminForCurrentUser();
        const isSystemMessage = post.type && post.type.startsWith(Constants.SYSTEM_MESSAGE_PREFIX);
        var timestamp = UserStore.getProfile(post.user_id).update_at;
        var channel = ChannelStore.get(post.channel_id);
        const flagIcon = Constants.FLAG_ICON_SVG;

        var type = 'Post';
        if (post.root_id.length > 0) {
            type = 'Comment';
        }

        var userCss = '';
        if (UserStore.getCurrentId() === post.user_id) {
            userCss = 'current--user';
        }

        var systemMessageClass = '';
        if (PostUtils.isSystemMessage(post)) {
            systemMessageClass = 'post--system';
        }

        var channelName;
        if (channel) {
            if (channel.type === 'D') {
                channelName = (
                    <FormattedMessage
                        id='rhs_root.direct'
                        defaultMessage='Direct Message'
                    />
                );
            } else {
                channelName = channel.display_name;
            }
        }

        var dropdownContents = [];

        if (Utils.isMobile()) {
            if (this.props.isFlagged) {
                dropdownContents.push(
                    <li
                        key='mobileFlag'
                        role='presentation'
                    >
                        <a
                            href='#'
                            onClick={this.unflagPost}
                        >
                            <FormattedMessage
                                id='rhs_root.mobile.unflag'
                                defaultMessage='Unflag'
                            />
                        </a>
                    </li>
                );
            } else {
                dropdownContents.push(
                    <li
                        key='mobileFlag'
                        role='presentation'
                    >
                        <a
                            href='#'
                            onClick={this.flagPost}
                        >
                            <FormattedMessage
                                id='rhs_root.mobile.flag'
                                defaultMessage='Flag'
                            />
                        </a>
                    </li>
                );
            }
        }

        dropdownContents.push(
            <li
                key='rhs-root-permalink'
                role='presentation'
            >
                <a
                    href='#'
                    onClick={this.handlePermalink}
                >
                    <FormattedMessage
                        id='rhs_root.permalink'
                        defaultMessage='Permalink'
                    />
                </a>
            </li>
        );

        if (isOwner && !isSystemMessage) {
            dropdownContents.push(
                <li
                    key='rhs-root-edit'
                    role='presentation'
                >
                    <a
                        href='#'
                        role='menuitem'
                        data-toggle='modal'
                        data-target='#edit_post'
                        data-refocusid='#reply_textbox'
                        data-title={type}
                        data-message={post.message}
                        data-postid={post.id}
                        data-channelid={post.channel_id}
                    >
                        <FormattedMessage
                            id='rhs_root.edit'
                            defaultMessage='Edit'
                        />
                    </a>
                </li>
            );
        }

        if (isOwner || isAdmin) {
            dropdownContents.push(
                <li
                    key='rhs-root-delete'
                    role='presentation'
                >
                    <a
                        href='#'
                        role='menuitem'
                        onClick={() => GlobalActions.showDeletePostModal(post, this.props.commentCount)}
                    >
                        <FormattedMessage
                            id='rhs_root.del'
                            defaultMessage='Delete'
                        />
                    </a>
                </li>
            );
        }

        var rootOptions = '';
        if (dropdownContents.length > 0) {
            rootOptions = (
                <div className='dropdown'>
                    <a
                        href='#'
                        className='post__dropdown dropdown-toggle'
                        type='button'
                        data-toggle='dropdown'
                        aria-expanded='false'
                    />
                    <ul
                        className='dropdown-menu'
                        role='menu'
                    >
                        {dropdownContents}
                    </ul>
                </div>
            );
        }

        var fileAttachment;
        if (post.filenames && post.filenames.length > 0) {
            fileAttachment = (
                <FileAttachmentList
                    filenames={post.filenames}
                    channelId={post.channel_id}
                    userId={post.user_id}
                    compactDisplay={this.props.compactDisplay}
                />
            );
        }

        let userProfile = <UserProfile user={user}/>;
        let botIndicator;

        if (post.props && post.props.from_webhook) {
            if (post.props.override_username && global.window.mm_config.EnablePostUsernameOverride === 'true') {
                userProfile = (
                    <UserProfile
                        user={user}
                        overwriteName={post.props.override_username}
                        disablePopover={true}
                    />
                );
            }

            botIndicator = <li className='col col__name bot-indicator'>{'BOT'}</li>;
        } else if (PostUtils.isSystemMessage(post)) {
            userProfile = (
                <UserProfile
                    user={{}}
                    overwriteName={Constants.SYSTEM_MESSAGE_PROFILE_NAME}
                    overwriteImage={Constants.SYSTEM_MESSAGE_PROFILE_IMAGE}
                    disablePopover={true}
                />
            );
        }

        let profilePic = (
            <img
                className='post-profile-img'
                src={PostUtils.getProfilePicSrcForPost(post, timestamp)}
                height='36'
                width='36'
            />
        );

        if (PostUtils.isSystemMessage(post)) {
            profilePic = (
                <span
                    className='icon'
                    dangerouslySetInnerHTML={{__html: mattermostLogo}}
                />
            );
        }

        let compactClass = '';
        let profilePicContainer = (<div className='post__img'>{profilePic}</div>);
        if (this.props.compactDisplay) {
            compactClass = 'post--compact';
            profilePicContainer = '';
        }

        const messageWrapper = (
            <div
                ref='message_holder'
                onClick={TextFormatting.handleClick}
                dangerouslySetInnerHTML={{__html: TextFormatting.formatText(post.message)}}
            />
        );

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
            flag = (
                <span
                    className='icon'
                    dangerouslySetInnerHTML={{__html: flagIcon}}
                />
            );
            flagFunc = this.unflagPost;
            flagTooltip = (
                <Tooltip id='flagTooltip'>
                    <FormattedMessage
                        id='flag_post.unflag'
                        defaultMessage='Unflag'
                    />
                </Tooltip>
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
            <div className={'post post--root post--thread ' + userCss + ' ' + systemMessageClass + ' ' + compactClass}>
                <div className='post-right-channel__name'>{channelName}</div>
                <div className='post__content'>
                    {profilePicContainer}
                    <div>
                        <ul className='post__header'>
                            <li className='col__name'>{userProfile}</li>
                            {botIndicator}
                            <li className='col'>
                                <time className='post__time'>
                                    <FormattedDate
                                        value={post.create_at}
                                        day='numeric'
                                        month='long'
                                        year='numeric'
                                        hour12={!this.props.useMilitaryTime}
                                        hour='2-digit'
                                        minute='2-digit'
                                    />
                                </time>
                                <OverlayTrigger
                                    key={'rootpostflagtooltipkey' + flagVisible}
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
                            <li className='col col__reply'>
                                {rootOptions}
                            </li>
                        </ul>
                        <div className='post__body'>
                            <PostBodyAdditionalContent
                                post={post}
                                message={messageWrapper}
                            />
                            {fileAttachment}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

RhsRootPost.defaultProps = {
    commentCount: 0
};
RhsRootPost.propTypes = {
    post: React.PropTypes.object.isRequired,
    user: React.PropTypes.object.isRequired,
    currentUser: React.PropTypes.object.isRequired,
    commentCount: React.PropTypes.number,
    compactDisplay: React.PropTypes.bool,
    useMilitaryTime: React.PropTypes.bool.isRequired,
    isFlagged: React.PropTypes.bool
};
