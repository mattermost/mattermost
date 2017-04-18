// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import React from 'react';
import {zipObject, keys, isPlainObject} from 'lodash';
import {FormattedMessage} from 'react-intl';

import * as GlobalActions from 'actions/global_actions.jsx';
import * as PostActions from 'actions/post_actions.jsx';
import DelayedAction from 'utils/delayed_action.jsx';
import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import Constants from 'utils/constants.jsx';

export default class PostOptionDropdown extends React.Component {
    constructor(props) {
        super(props);
        this.handlePermalink = this.handlePermalink.bind(this);
        this.pinPost = this.pinPost.bind(this);
        this.unpinPost = this.unpinPost.bind(this);
        this.flagPost = this.flagPost.bind(this);
        this.unflagPost = this.unflagPost.bind(this);
        this.handleEditDisable = this.handleEditDisable.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        this.handleDropdownOpened = this.handleDropdownOpened.bind(this);
        this.editDisableAction = new DelayedAction(this.handleEditDisable);
        this.initSwitches();
    }

    initSwitches() {
        this.setSwitches(this.props);

        this.switchKeys = keys(this.switches);
        this.switchHandler = zipObject(this.switchKeys,
            [
                this.handlePermalink,
                this.props.handleCommentClick,
                {
                    true: this.unpinPost,
                    false: this.pinPost
                },
                this.handleDelete,
                null,
                {
                    false: this.flagPost,
                    true: this.unflagPost
                }
            ]
        );
    }

    setSwitches(props) {
        const post = props.post;
        this.switches = {
            permalink: !PostUtils.isSystemMessage(post),
            reply: props.allowReply,
            pin: post.is_pinned,
            del: PostUtils.canDeletePost(post),
            edit: PostUtils.canEditPost(post, this.editDisableAction)
        };
        if (Utils.isMobile()) {
            this.switches.flag = props.isFlagged;
        }
    }

    componentWillUpdate(props) {
        this.setSwitches(props);
    }

    handleDropdownOpened() {
        this.props.handleDropdownOpened(true);

        const position = $('#post-list').height() - $(this.refs.dropdownToggle).offset().top;
        const dropdown = $(this.refs.dropdown);

        if (position < dropdown.height()) {
            dropdown.addClass('bottom');
        }
    }

    componentDidMount() {
        $('#post_dropdown' + this.props.post.id).on('shown.bs.dropdown', this.handleDropdownOpened);
        $('#post_dropdown' + this.props.post.id).on('hidden.bs.dropdown', () => this.props.handleDropdownOpened(false));
    }

    handlePermalink(e) {
        e.preventDefault();
        GlobalActions.showGetPostLinkModal(this.props.post);
    }

    handleEditDisable() {
        this.switches.edit = false;
    }

    handleDelete(e) {
        const post = this.props.post;
        let type = 'Post';
        if (post.root_id && post.root_id.length > 0) {
            type = 'Comment';
        }
        let dataComments = 0;
        if (type === 'Post') {
            dataComments = this.props.commentCount;
        }
        e.preventDefault();
        GlobalActions.showDeletePostModal(post, dataComments);
    }

    pinPost(e) {
        e.preventDefault();
        PostActions.pinPost(this.props.post.channel_id, this.props.post.id);
    }

    unpinPost(e) {
        e.preventDefault();
        PostActions.unpinPost(this.props.post.channel_id, this.props.post.id);
    }

    flagPost(e) {
        e.preventDefault();
        PostActions.flagPost(this.props.post.id);
    }

    unflagPost(e) {
        e.preventDefault();
        PostActions.unflagPost(this.props.post.id);
    }

    getDropdownItem(switchName) {
        let handler = this.switchHandler[switchName];
        let prefix = '';
        if (isPlainObject(handler)) {
            handler = handler[this.switches[switchName]];
            prefix = this.switches[switchName] ? 'un' : '';
        }
        if (handler) {
            return (
                <li
                    key={switchName + 'Link'}
                    role='presentation'
                >
                    <a
                        className={'theme link__' + switchName}
                        href='#'
                        role='menuitem'
                        onClick={handler}
                    >
                        <FormattedMessage
                            id={'post_info.' + prefix + switchName}
                        />
                    </a>
                </li>
            );
        }
        return '';
    }

    createDropdown() {
        const post = this.props.post;

        if (post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING) {
            return '';
        }

        let type = 'Post';
        if (post.root_id && post.root_id.length > 0) {
            type = 'Comment';
        }

        let dataComments = 0;
        if (type === 'Post') {
            dataComments = this.props.commentCount;
        }
        const dropdownContents = [];
        for (const key of this.switchKeys) {
            dropdownContents.push(this.getDropdownItem(key));
        }

        // TODO: merge 'edit' to switches by stop using bs modal
        if (this.switches.edit) {
            dropdownContents.push(
                <li
                    key='editPost'
                    role='presentation'
                    className={'dropdown-submenu'}
                >
                    <a
                        href='#'
                        role='menuitem'
                        data-toggle='modal'
                        data-target='#edit_post'
                        data-refocusid='#post_textbox'
                        data-title={type}
                        data-message={post.message}
                        data-postid={post.id}
                        data-channelid={post.channel_id}
                        data-comments={dataComments}
                    >
                        <FormattedMessage
                            id='post_info.edit'
                            defaultMessage='Edit'
                        />
                    </a>
                </li>
            );
        }

        return dropdownContents;
    }

    render() {
        const post = this.props.post;

        if (post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING) {
            return '';
        }
        const dropdownContents = this.createDropdown();
        if (dropdownContents.length === 0) {
            return '';
        }
        return (
            <div
                className='dropdown'
                ref='dotMenu'
            >
                <div
                    id={'post_dropdown' + this.props.post.id}
                >
                    <a
                        ref='dropdownToggle'
                        href='#'
                        className='dropdown-toggle post__dropdown theme'
                        type='button'
                        data-toggle='dropdown'
                        aria-expanded='false'
                    />
                    <div className='dropdown-menu__content'>
                        <ul
                            ref='dropdown'
                            className='dropdown-menu'
                            role='menu'
                        >
                            {dropdownContents}
                        </ul>
                    </div>
                </div>
            </div>
        );
    }
}

PostOptionDropdown.defaultProps = {
    post: null,
    allowReply: false
};
PostOptionDropdown.propTypes = {
    post: React.PropTypes.object.isRequired,
    commentCount: React.PropTypes.number.isRequired,
    allowReply: React.PropTypes.bool.isRequired,
    handleDropdownOpened: React.PropTypes.func.isRequired,
    isFlagged: React.PropTypes.bool,
    handleCommentClick: React.PropTypes.func.isRequired
};
