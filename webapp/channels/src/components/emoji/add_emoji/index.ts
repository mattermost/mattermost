// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {createCustomEmoji} from 'mattermost-redux/actions/emojis';

import {getEmojiMap} from 'selectors/emojis';

import AddEmoji from './add_emoji';

import type {CustomEmoji} from '@mattermost/types/emojis';
import type {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

type Actions = {
    createCustomEmoji: (emoji: CustomEmoji, imageData: File) => Promise<ActionResult>;
};

function mapStateToProps(state: GlobalState) {
    return {
        emojiMap: getEmojiMap(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            createCustomEmoji,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddEmoji);
