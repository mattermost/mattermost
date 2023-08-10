// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getCustomEmojis, searchCustomEmojis} from 'mattermost-redux/actions/emojis';
import {getCustomEmojiIdsSortedByName} from 'mattermost-redux/selectors/entities/emojis';

import EmojiList from './emoji_list';

import type {CustomEmoji} from '@mattermost/types/emojis';
import type {ServerError} from '@mattermost/types/errors';
import type {GlobalState} from '@mattermost/types/store';
import type {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

type Actions = {
    getCustomEmojis: (page?: number, perPage?: number, sort?: string, loadUsers?: boolean) => Promise<{ data: CustomEmoji[]; error: ServerError }>;
    searchCustomEmojis: (term: string, options: any, loadUsers: boolean) => Promise<{ data: CustomEmoji[]; error: ServerError }>;
}

function mapStateToProps(state: GlobalState) {
    return {
        emojiIds: getCustomEmojiIdsSortedByName(state) || [],
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            getCustomEmojis,
            searchCustomEmojis,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EmojiList);
