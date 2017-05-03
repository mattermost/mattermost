// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

export default function CommentIcon(props) {
    let commentCountSpan = '';
    let iconStyle = 'comment-icon__container';
    if (props.commentCount > 0) {
        iconStyle += ' icon--show';
        commentCountSpan = (
            <span className='comment-count'>
                {props.commentCount}
            </span>
        );
    } else if (props.searchStyle !== '') {
        iconStyle = iconStyle + ' ' + props.searchStyle;
    }

    let commentIconId = props.idPrefix;
    if (props.idCount > -1) {
        commentIconId += props.idCount;
    }

    return (
        <a
            id={Utils.createSafeId(commentIconId)}
            href='#'
            className={iconStyle}
            onClick={props.handleCommentClick}
        >
            <span
                className='comment-icon'
                dangerouslySetInnerHTML={{__html: Constants.REPLY_ICON}}
            />
            {commentCountSpan}
        </a>
    );
}

CommentIcon.propTypes = {
    idPrefix: React.PropTypes.string.isRequired,
    idCount: React.PropTypes.number,
    handleCommentClick: React.PropTypes.func.isRequired,
    searchStyle: React.PropTypes.string,
    commentCount: React.PropTypes.number
};

CommentIcon.defaultProps = {
    idCount: -1,
    searchStyle: '',
    commentCount: 0
};