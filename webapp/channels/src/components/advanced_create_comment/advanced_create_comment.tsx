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
    focusOnMount?: boolean; // not used, but kept in case we have to use it again
}

class AdvancedCreateComment extends React.PureComponent<Props> {
    render() {
        return (
            <AdvancedTextEditor
                location={Locations.RHS_COMMENT}
                channelId={this.props.channelId}
                postId={this.props.rootId}
                isThreadView={this.props.isThreadView}
                placeholder={this.props.placeholder}
            />
        );
    }
}

export default AdvancedCreateComment;
