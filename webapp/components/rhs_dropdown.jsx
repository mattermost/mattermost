// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Agent from 'utils/user_agent.jsx';
import RhsDropdownMenu from 'components/rhs_dropdown_menu.jsx';

import {Dropdown} from 'react-bootstrap';
import React from 'react';
import {zipObject, keys, isPlainObject} from 'lodash';
import {FormattedMessage} from 'react-intl';

import * as GlobalActions from 'actions/global_actions.jsx';
import * as PostActions from 'actions/post_actions.jsx';
import DelayedAction from 'utils/delayed_action.jsx';
import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import Constants from 'utils/constants.jsx';

export default class RhsDropdown extends React.Component {
    constructor(props) {
        super(props);

        this.toggleDropdown = this.toggleDropdown.bind(this);
        this.handlePermalink = this.handlePermalink.bind(this);
        this.pinPost = this.pinPost.bind(this);
        this.unpinPost = this.unpinPost.bind(this);
        this.handleEditDisable = this.handleEditDisable.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        this.editDisableAction = new DelayedAction(this.handleEditDisable);
        this.initSwitches();
        this.state = {
            showDropdown: false
        };
    }

    initSwitches() {
        this.setSwitches(this.props);

        this.switchKeys = keys(this.switches);
        this.switchHandler = zipObject(this.switchKeys,
            [
                this.handlePermalink,
                {
                    true: this.unpinPost,
                    false: this.pinPost
                },
                this.handleDelete,
                null,
                {
                    false: this.props.flagPost,
                    true: this.props.unflagPost
                }
            ]
        );
    }

    setSwitches(props) {
        const post = props.post;
        this.switches = {
            permalink: !PostUtils.isSystemMessage(post),
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
                    key={'rhs-comment-' + prefix + switchName}
                    role='presentation'
                >
                    <a
                        className={'theme link__' + switchName}
                        href='#'
                        role='menuitem'
                        onClick={handler}
                    >
                        <FormattedMessage
                            id={'rhs_root.' + prefix + switchName}
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
                        data-refocusid='#reply_textbox'
                        data-title={Utils.localizeMessage('rhs_comment.comment', 'Comment')}
                        data-message={post.message}
                        data-postid={post.id}
                        data-channelid={post.channel_id}
                        data-comments={dataComments}
                    >
                        <FormattedMessage
                            id='rhs_comment.edit'
                            defaultMessage='Edit'
                        />
                    </a>
                </li>
            );
        }

        return dropdownContents;
    }

    toggleDropdown() {
        const showDropdown = !this.state.showDropdown;
        if (Agent.isMobile() || Agent.isMobileApp()) {
            const scroll = document.querySelector('.scrollbar--view');
            if (scroll) {
                if (showDropdown) {
                    scroll.style.overflow = 'hidden';
                } else {
                    scroll.style.overflow = 'scroll';
                }
            }
        }

        this.setState({showDropdown});
    }

    render() {
        return (
            <Dropdown
                id='rhs_dropdown'
                open={this.state.showDropdown}
                onToggle={this.toggleDropdown}
            >
                <a
                    href='#'
                    className='post__dropdown dropdown-toggle'
                    bsRole='toggle'
                    onClick={this.toggleDropdown}
                />
                <RhsDropdownMenu>
                    {this.createDropdown()}
                </RhsDropdownMenu>
            </Dropdown>
        );
    }
}

RhsDropdown.defaultProps = {
    post: null,
    commentCount: 0
};

RhsDropdown.propTypes = {
    post: React.PropTypes.object.isRequired,
    commentCount: React.PropTypes.number.isRequired,
    isFlagged: React.PropTypes.bool,
    flagPost: React.PropTypes.func.isRequired,
    unflagPost: React.PropTypes.func.isRequired
};
