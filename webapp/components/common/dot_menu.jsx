// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import React, {Component, PropTypes} from 'react';

import DotMenuFlag from './dot_menu_flag.jsx';
import DotMenuItem from './dot_menu_item.jsx';
import DotMenuEdit from './dot_menu_edit.jsx';

import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import Constants from 'utils/constants.jsx';
import DelayedAction from 'utils/delayed_action.jsx';

export default class DotMenu extends Component {
    static propTypes = {
        idPrefix: React.PropTypes.string.isRequired,
        idCount: PropTypes.number,
        post: PropTypes.object.isRequired,
        commentCount: PropTypes.number,
        isFlagged: PropTypes.bool,
        handleCommentClick: PropTypes.func,
        handleDropdownOpened: PropTypes.func
    }

    static defaultProps = {
        idCount: -1,
        post: {},
        commentCount: 0,
        isFlagged: false
    }

    constructor(props) {
        super(props);

        this.handleDropdownOpened = this.handleDropdownOpened.bind(this);
        this.canDelete = false;
        this.canEdit = false;
        this.editDisableAction = new DelayedAction(this.handleEditDisable);
    }

    componentDidMount() {
        if (this.props.idPrefix === Constants.CENTER) {
            $('#post_dropdown' + this.props.post.id).on('shown.bs.dropdown', this.handleDropdownOpened);
            $('#post_dropdown' + this.props.post.id).on('hidden.bs.dropdown', () => this.props.handleDropdownOpened(false));
        }
    }

    handleDropdownOpened() {
        this.props.handleDropdownOpened(true);

        const position = $('#post-list').height() - $(this.refs.dropdownToggle).offset().top;
        const dropdown = $(this.refs.dropdown);

        if (position < dropdown.height()) {
            dropdown.addClass('bottom');
        }
    }

    handleEditDisable() {
        this.canEdit = false;
    }

    render() {
        const isSystemMessage = PostUtils.isSystemMessage(this.props.post);
        const isMobile = Utils.isMobile();
        this.canDelete = PostUtils.canDeletePost(this.props.post);
        this.canEdit = PostUtils.canEditPost(this.props.post, this.editDisableAction);

        if (this.props.idPrefix === Constants.CENTER && (!isMobile && isSystemMessage && !this.canDelete && !this.canEdit)) {
            return null;
        }

        if (this.props.idPrefix === Constants.RHS && (this.props.post.state === Constants.POST_FAILED || this.props.post.state === Constants.POST_LOADING)) {
            return null;
        }

        let type = 'Post';
        if (this.props.post.root_id && this.props.post.root_id.length > 0) {
            type = 'Comment';
        }

        const idPrefix = this.props.idPrefix + 'DotMenu';

        let dotMenuFlag = null;
        if (isMobile) {
            dotMenuFlag = (
                <DotMenuFlag
                    idPrefix={idPrefix + 'Flag'}
                    idCount={this.props.idCount}
                    postId={this.props.post.id}
                    isFlagged={this.props.isFlagged}
                />
            );
        }

        let dotMenuReply = null;
        let dotMenuPermalink = null;
        let dotMenuPin = null;
        if (!isSystemMessage) {
            if (this.props.idPrefix === Constants.CENTER) {
                dotMenuReply = (
                    <DotMenuItem
                        idPrefix={idPrefix + 'Reply'}
                        idCount={this.props.idCount}
                        handleOnClick={this.props.handleCommentClick}
                    />
                );
            }

            dotMenuPermalink = (
                <DotMenuItem
                    idPrefix={idPrefix + 'Permalink'}
                    idCount={this.props.idCount}
                    post={this.props.post}
                />
            );

            dotMenuPin = (
                <DotMenuItem
                    idPrefix={idPrefix + 'Pin'}
                    idCount={this.props.idCount}
                    post={this.props.post}
                />
            );
        }

        let dotMenuDelete = null;
        if (this.canDelete) {
            dotMenuDelete = (
                <DotMenuItem
                    idPrefix={idPrefix + 'Delete'}
                    idCount={this.props.idCount}
                    post={this.props.post}
                    commentCount={type === 'Post' ? this.props.commentCount : 0}
                />
            );
        }

        let dotMenuEdit = null;
        if (this.canEdit) {
            dotMenuEdit = (
                <DotMenuEdit
                    idPrefix={idPrefix + 'Edit'}
                    idCount={this.props.idCount}
                    post={this.props.post}
                    type={type}
                    commentCount={type === 'Post' ? this.props.commentCount : 0}
                />
            );
        }

        let dotMenuId = null;
        if (this.props.idCount > -1) {
            dotMenuId = Utils.createSafeId(idPrefix + this.props.idCount);
        }

        if (this.props.idPrefix === 'rhsRoot') {
            dotMenuId = idPrefix;
        }

        return (
            <div
                id={dotMenuId}
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
                            {dotMenuReply}
                            {dotMenuFlag}
                            {dotMenuPermalink}
                            {dotMenuPin}
                            {dotMenuDelete}
                            {dotMenuEdit}
                        </ul>
                    </div>
                </div>
            </div>
        );
    }
}
