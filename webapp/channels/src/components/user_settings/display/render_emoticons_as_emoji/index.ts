// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import RenderEmoticonsAsEmoji from './render_emoticons_as_emoji';
import type {OwnProps} from './render_emoticons_as_emoji';

export function mapStateToProps(state: GlobalState, props: OwnProps) {
    const userPreferences = props.adminMode && props.userPreferences ? props.userPreferences : undefined;

    return {
        userId: props.adminMode ? props.userId : getCurrentUserId(state),
        renderEmoticonsAsEmoji: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.RENDER_EMOTICONS_AS_EMOJI, Preferences.RENDER_EMOTICONS_AS_EMOJI_DEFAULT, userPreferences),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            savePreferences,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RenderEmoticonsAsEmoji);
