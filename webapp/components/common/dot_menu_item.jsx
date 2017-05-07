// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {PropTypes} from 'react';
import {FormattedMessage} from 'react-intl';

import {unpinPost, pinPost} from 'actions/post_actions.jsx';
import {showGetPostLinkModal, showDeletePostModal} from 'actions/global_actions.jsx';
import * as Utils from 'utils/utils.jsx';

export default function DotMenuItem(props) {
    function handlePermalink(e) {
        e.preventDefault();
        showGetPostLinkModal(props.post);
    }

    function handleUnpinPost(e) {
        e.preventDefault();
        unpinPost(props.post.channel_id, props.post.id);
    }

    function handlePinPost(e) {
        e.preventDefault();
        pinPost(props.post.channel_id, props.post.id);
    }

    function handleDeletePost(e) {
        e.preventDefault();
        showDeletePostModal(props.post, props.commentCount);
    }

    const attrib = {};
    attrib.idPrefix = props.idPrefix;
    attrib.class = '';

    switch (props.idPrefix.substring((props.idPrefix.indexOf('DotMenu') + 7))) {
    case 'Reply':
        attrib.class = 'link__reply theme';
        attrib.onClick = props.handleOnClick;
        attrib.formattedMessageId = 'post_info.reply';
        attrib.formattedDefaultMessage = 'Reply';
        break;
    case 'Permalink':
        attrib.onClick = handlePermalink;
        attrib.formattedMessageId = 'post_info.permalink';
        attrib.formattedDefaultMessage = 'Permalink';
        attrib.post = props.post;
        break;
    case 'Pin':
        attrib.onClick = props.post.is_pinned ? handleUnpinPost : handlePinPost;
        attrib.formattedMessageId = props.post.is_pinned ? 'post_info.unpin' : 'post_info.pin';
        attrib.formattedDefaultMessage = props.post.is_pinned ? 'Un-pin from channel' : 'Pin from channel';
        attrib.post = props.post;
        break;
    case 'Delete':
        attrib.onClick = handleDeletePost;
        attrib.formattedMessageId = 'post_info.del';
        attrib.formattedDefaultMessage = 'Delete';
        attrib.commentCount = props.commentCount;
        break;
    default:
    }

    let itemId = null;
    if (props.idCount > -1) {
        itemId = Utils.createSafeId(props.idPrefix + props.idCount);
    }

    if (attrib.idPrefix.indexOf('rhsRoot') === 0) {
        itemId = attrib.idPrefix;
    }

    return (
        <li
            id={Utils.createSafeId(itemId)}
            key={attrib.idPrefix}
            role='presentation'
        >
            <a
                href='#'
                role='menuitem'
                onClick={attrib.onClick}
            >
                <FormattedMessage
                    id={attrib.formattedMessageId}
                    defaultMessage={attrib.formattedDefaultMessage}
                />
            </a>
        </li>
    );
}

DotMenuItem.propTypes = {
    idPrefix: PropTypes.string.isRequired,
    idCount: PropTypes.number,
    post: PropTypes.object,
    handleOnClick: PropTypes.func,
    type: PropTypes.string,
    commentCount: PropTypes.number
};

DotMenuItem.defaultProps = {
    idPrefix: '',
    idCount: -1
};
