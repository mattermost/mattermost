// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserProfile from './user_profile.jsx';
import FileAttachmentList from './file_attachment_list.jsx';
import PendingPostOptions from 'components/post_view/components/pending_post_options.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import {flagPost, unflagPost} from 'actions/post_actions.jsx';

import * as TextFormatting from 'utils/text_formatting.jsx';
import * as Utils from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';

import Constants from 'utils/constants.jsx';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {FormattedMessage, FormattedDate} from 'react-intl';

import loadingGif from 'images/load.gif';

import React from 'react';

export default class RhsComment extends React.Component {
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

    createDropdown() {
        var post = this.props.post;

        if (post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING || post.state === Constants.POST_DELETED) {
            return '';
        }

        const isOwner = this.props.currentUser.id === post.user_id;
        var isAdmin = TeamStore.isTeamAdminForCurrentTeam() || UserStore.isSystemAdminForCurrentUser();
        const isSystemMessage = post.type && post.type.startsWith(Constants.SYSTEM_MESSAGE_PREFIX);

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
                        id='rhs_comment.permalink'
                        defaultMessage='Permalink'
                    />
                </a>
            </li>
        );

        if (isOwner && !isSystemMessage) {
            dropdownContents.push(
                <li
                    role='presentation'
                    key='edit-button'
                >
                    <a
                        href='#'
                        role='menuitem'
                        data-toggle='modal'
                        data-target='#edit_post'
                        data-refocusid='#reply_textbox'
                        data-title={Utils.localizeMessage('rhs_comment.comment', 'Comment')}
                        data-message={post.message}
                        data-postid={post.id}
                        data-channelid={post.channel_id}
                    >
                        <FormattedMessage
                            id='rhs_comment.edit'
                            defaultMessage='Edit'
                        />
                    </a>
                </li>
            );
        }

        if (isOwner || isAdmin) {
            dropdownContents.push(
                <li
                    role='presentation'
                    key='delete-button'
                >
                    <a
                        href='#'
                        role='menuitem'
                        onClick={() => GlobalActions.showDeletePostModal(post, 0)}
                    >
                        <FormattedMessage
                            id='rhs_comment.del'
                            defaultMessage='Delete'
                        />
                    </a>
                </li>
            );
        }

        if (dropdownContents.length === 0) {
            return '';
        }

        return (
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

    render() {
        var post = this.props.post;
        const flagIcon = Constants.FLAG_ICON_SVG;

        var currentUserCss = '';
        if (this.props.currentUser === post.user_id) {
            currentUserCss = 'current--user';
        }

        var timestamp = this.props.currentUser.update_at;

        let botIndicator;

        if (post.props && post.props.from_webhook) {
            botIndicator = <li className='bot-indicator'>{Constants.BOT_NAME}</li>;
        }
        let loading;
        let postClass = '';
        let message = (
            <div
                ref='message_holder'
                onClick={TextFormatting.handleClick}
                dangerouslySetInnerHTML={{__html: TextFormatting.formatText(post.message)}}
            />
        );

        if (post.state === Constants.POST_FAILED) {
            postClass += ' post-fail';
            loading = <PendingPostOptions post={this.props.post}/>;
        } else if (post.state === Constants.POST_LOADING) {
            postClass += ' post-waiting';
            loading = (
                <img
                    className='post-loading-gif pull-right'
                    src={loadingGif}
                />
            );
        } else if (this.props.post.state === Constants.POST_DELETED) {
            message = (
                <FormattedMessage
                    id='post_body.deleted'
                    defaultMessage='(message deleted)'
                />
            );
        }

        let profilePic = (
            <img
                src={Client.getUsersRoute() + '/' + post.user_id + '/image?time=' + timestamp}
                height='36'
                width='36'
            />
        );

        let compactClass = '';
        let profilePicContainer = (<div className='post__img'>{profilePic}</div>);
        if (this.props.compactDisplay) {
            compactClass = 'post--compact';
            profilePicContainer = '';
        }

        var dropdown = this.createDropdown();

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
            <div className={'post post--thread ' + currentUserCss + ' ' + compactClass}>
                <div className='post__content'>
                    {profilePicContainer}
                    <div>
                        <ul className='post__header'>
                            <li className='col col__name'>
                                <strong><UserProfile user={this.props.user}/></strong>
                            </li>
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
                                    key={'commentflagtooltipkey' + flagVisible}
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
                                {dropdown}
                            </li>
                        </ul>
                        <div className='post__body'>
                            <div className={postClass}>
                                {loading}
                                {message}
                            </div>
                            {fileAttachment}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

RhsComment.propTypes = {
    post: React.PropTypes.object,
    user: React.PropTypes.object.isRequired,
    currentUser: React.PropTypes.object.isRequired,
    compactDisplay: React.PropTypes.bool,
    useMilitaryTime: React.PropTypes.bool.isRequired,
    isFlagged: React.PropTypes.bool
};
