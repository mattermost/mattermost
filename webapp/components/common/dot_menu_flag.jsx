// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {PropTypes} from 'react';
import {FormattedMessage} from 'react-intl';

import {flagPost, unflagPost} from 'actions/post_actions.jsx';
import * as Utils from 'utils/utils.jsx';

function formatMessage(isFlagged) {
    return (
        <FormattedMessage
            id={isFlagged ? 'rhs_root.mobile.unflag' : 'rhs_root.mobile.flag'}
            defaultMessage={isFlagged ? 'Unflag' : 'Flag'}
        />
    );
}

export default function DotMenuFlag(props) {
    function onFlagPost(e) {
        e.preventDefault();
        flagPost(props.postId);
    }

    function onUnflagPost(e) {
        e.preventDefault();
        unflagPost(props.postId);
    }

    const flagFunc = props.isFlagged ? onUnflagPost : onFlagPost;

    let flagId = null;
    if (props.idCount > -1) {
        flagId = Utils.createSafeId(props.idPrefix + props.idCount);
    }

    if (props.idPrefix.indexOf('rhsRoot') === 0) {
        flagId = props.idPrefix;
    }

    return (
        <li
            key={props.idPrefix}
            role='presentation'
        >
            <a
                id={flagId}
                href='#'
                onClick={flagFunc}
            >
                {formatMessage(props.isFlagged)}
            </a>
        </li>
    );
}

DotMenuFlag.propTypes = {
    idCount: PropTypes.number,
    idPrefix: PropTypes.string.isRequired,
    postId: PropTypes.string.isRequired,
    isFlagged: PropTypes.bool.isRequired
};

DotMenuFlag.defaultProps = {
    idCount: -1,
    postId: '',
    isFlagged: false
};
