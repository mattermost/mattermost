// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getCustomEmojis, searchCustomEmojis} from 'mattermost-redux/actions/emojis';
import {getCustomEmojisEnabled} from 'mattermost-redux/selectors/entities/emojis';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {incrementEmojiPickerPage, setUserSkinTone} from 'actions/emoji_actions';
import {getEmojiMap, getRecentEmojisNames, getUserSkinTone} from 'selectors/emojis';

import type {GlobalState} from 'types/store';

import EmojiPicker from './emoji_picker';

function mapStateToProps(state: GlobalState) {
    return {
        customEmojisEnabled: getCustomEmojisEnabled(state),
        customEmojiPage: state.views.emoji.emojiPickerCustomPage,
        emojiMap: getEmojiMap(state),
        recentEmojis: getRecentEmojisNames(state),
        userSkinTone: getUserSkinTone(state),
        currentTeamName: getCurrentTeam(state)?.name ?? '',
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getCustomEmojis,
            searchCustomEmojis,
            incrementEmojiPickerPage,
            setUserSkinTone,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(EmojiPicker);
