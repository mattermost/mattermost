// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CustomEmoji} from '@mattermost/types/emojis';
import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {createCustomEmoji} from 'mattermost-redux/actions/emojis';
import {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import {getEmojiMap} from 'selectors/emojis';

import {GlobalState} from 'types/store';

import AddEmoji from './add_emoji';

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
