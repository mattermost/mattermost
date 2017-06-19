import PropTypes from 'prop-types';

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

    let selectorId = props.idPrefix;
    if (props.idCount > -1) {
        selectorId += props.idCount;
    }

    const id = Utils.createSafeId(props.idPrefix + '_' + props.id);

    return (
        <a
            id={id}
            href='#'
            className={iconStyle + ' ' + selectorId}
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
    idPrefix: PropTypes.string.isRequired,
    idCount: PropTypes.number,
    handleCommentClick: PropTypes.func.isRequired,
    searchStyle: PropTypes.string,
    commentCount: PropTypes.number,
    id: PropTypes.string
};

CommentIcon.defaultProps = {
    idCount: -1,
    searchStyle: '',
    commentCount: 0,
    id: ''
};
