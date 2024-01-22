// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {createCustomEmoji} from 'mattermost-redux/actions/emojis';

import {getEmojiMap} from 'selectors/emojis';

import type {GlobalState} from 'types/store';

import AddEmoji from './add_emoji';

function mapStateToProps(state: GlobalState) {
    return {
        emojiMap: getEmojiMap(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            createCustomEmoji,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddEmoji);
