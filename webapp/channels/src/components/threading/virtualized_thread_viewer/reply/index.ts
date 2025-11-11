// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {get, getBool} from 'mattermost-redux/selectors/entities/preferences';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import Reply from './reply';

type OwnProps = {
    id: string;
    isRootPost?: boolean;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const previewCollapsed = get(
        state,
        Preferences.CATEGORY_DISPLAY_SETTINGS,
        Preferences.COLLAPSE_DISPLAY,
        Preferences.COLLAPSE_DISPLAY_DEFAULT,
    );
    const previewEnabled = getBool(
        state,
        Preferences.CATEGORY_DISPLAY_SETTINGS,
        Preferences.LINK_PREVIEW_DISPLAY,
        Preferences.LINK_PREVIEW_DISPLAY_DEFAULT === 'true',
    );

    const post = getPost(state, ownProps.id);

    return {
        post,
        previewEnabled,
        previewCollapsed,
        isRootPost: ownProps.isRootPost,
    };
}

export default connect(mapStateToProps)(Reply);
