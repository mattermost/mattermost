// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';
import {useSelector} from 'react-redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import AdvancedTextEditor from 'components/advanced_text_editor/advanced_text_editor';

import {Locations} from 'utils/constants';

const AdvancedCreatePost = () => {
    const currentChannelId = useSelector(getCurrentChannelId);

    if (!currentChannelId) {
        return null;
    }

    return (
        <AdvancedTextEditor
            location={Locations.CENTER}
            rootId={''}
            channelId={currentChannelId}
        />
    );
};

export default React.memo(AdvancedCreatePost);
