// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';

import type {SubmitPostReturnType} from 'actions/views/create_comment';

import AdvancedTextEditor from 'components/advanced_text_editor/advanced_text_editor';

import {Locations} from 'utils/constants';

export type Props = {

    // The channel for which this comment is a part of
    channelId: string;

    // The id of the parent post
    rootId: string;

    isThreadView?: boolean;
    placeholder?: string;

    /**
     * Used by plugins to act after the post is made
     */
    afterSubmit?: (response: SubmitPostReturnType) => void;
}

const AdvancedCreateComment = ({
    channelId,
    rootId,
    isThreadView,
    placeholder,
    afterSubmit,
}: Props) => {
    return (
        <AdvancedTextEditor
            location={Locations.RHS_COMMENT}
            channelId={channelId}
            rootId={rootId}
            isThreadView={isThreadView}
            placeholder={placeholder}
            afterSubmit={afterSubmit}
        />
    );
};

export default React.memo(AdvancedCreateComment);
