// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';

import AdvancedTextEditor from 'components/advanced_text_editor/advanced_text_editor';

import {Locations} from 'utils/constants';

export type Props = {

    // The channel for which this comment is a part of
    channelId: string;

    // The id of the parent post
    rootId: string;

    isThreadView?: boolean;
    placeholder?: string;
}

const AdvancedCreateComment = ({
    channelId,
    rootId,
    isThreadView,
    placeholder,
}: Props) => {
    return (
        <AdvancedTextEditor
            location={Locations.RHS_COMMENT}
            channelId={channelId}
            postId={rootId}
            isThreadView={isThreadView}
            placeholder={placeholder}
        />
    );
};

export default React.memo(AdvancedCreateComment);
