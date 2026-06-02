// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useContext, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {UserAutocomplete} from '@mattermost/types/autocomplete';
import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {MmStaticSelectBlock} from '@mattermost/types/mm_blocks';
import type {UserProfile} from '@mattermost/types/users';

import {secureGetFromRecord} from 'mattermost-redux/utils/post_utils';

import {autocompleteChannels} from 'actions/channel_actions';
import {autocompleteUsers} from 'actions/user_actions';

import AutocompleteSelector from 'components/autocomplete_selector';
import type {Option, Selected} from 'components/autocomplete_selector';
import PostContext from 'components/post_view/post_context';
import GenericChannelProvider from 'components/suggestion/generic_channel_provider';
import GenericUserProvider from 'components/suggestion/generic_user_provider';
import MenuActionProvider from 'components/suggestion/menu_action_provider';

import {ActionTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {MmBlocksInteractionsDisabledContext} from './context';
import type {ActionHandler} from './types';

type MmBlocksSelectProvider = GenericUserProvider | GenericChannelProvider | MenuActionProvider;

type StaticSelectElementProps = {
    element: MmStaticSelectBlock;
    postId: string;
    onAction: ActionHandler;
};

function staticSelectDisplayValue(
    element: MmStaticSelectBlock,
    reduxText: string | undefined,
): string {
    if (reduxText) {
        return reduxText;
    }
    const opts = element.options ?? [];
    if (element.initial_option) {
        const sel = opts.find((o) => o.value === element.initial_option);
        return sel ? sel.text : '';
    }
    return '';
}

export const StaticSelectElement = ({element, postId, onAction}: StaticSelectElementProps) => {
    const dispatch = useDispatch();
    const interactionsDisabled = useContext(MmBlocksInteractionsDisabledContext);
    const [isExecuting, setIsExecuting] = useState(false);
    const reduxSelection = useSelector((state: GlobalState) => {
        const actions = state.views.posts.menuActions[postId];
        return element.action_id ? secureGetFromRecord(actions, element.action_id) : undefined;
    });

    const wrapAutocompleteUsers = useCallback(
        (username: string) => dispatch(autocompleteUsers(username)) as Promise<UserAutocomplete>,
        [dispatch],
    );

    const wrapAutocompleteChannels = useCallback(
        (term: string, success: (channels: Channel[]) => void, error?: (err: ServerError) => void) => {
            return dispatch(autocompleteChannels(term, success, error));
        },
        [dispatch],
    );

    const providers = useMemo((): MmBlocksSelectProvider[] => {
        if (element.data_source === 'users') {
            return [new GenericUserProvider(wrapAutocompleteUsers)];
        }
        if (element.data_source === 'channels') {
            return [new GenericChannelProvider(wrapAutocompleteChannels)];
        }
        const opts = element.options ?? [];
        if (opts.length > 0) {
            return [new MenuActionProvider(opts)];
        }
        return [];
    }, [element.data_source, element.options, wrapAutocompleteUsers, wrapAutocompleteChannels]);

    const value = staticSelectDisplayValue(element, reduxSelection?.text);

    const handleSelected = useCallback(
        async (selected: Selected) => {
            if (interactionsDisabled || !selected || !element.action_id || isExecuting) {
                return;
            }

            let selectedOption = '';
            let text = '';
            if (element.data_source === 'users') {
                const user = selected as UserProfile;
                text = user.username;
                selectedOption = user.id;
            } else if (element.data_source === 'channels') {
                const channel = selected as Channel;
                text = channel.display_name;
                selectedOption = channel.id;
            } else {
                const option = selected as Option;
                text = option.text;
                selectedOption = option.value;
            }

            dispatch({
                type: ActionTypes.SELECT_ATTACHMENT_MENU_ACTION,
                data: {
                    postId,
                    actions: {
                        [element.action_id]: {
                            text,
                            value: selectedOption,
                        },
                    },
                },
            });

            setIsExecuting(true);
            try {
                await onAction(element.action_id, selectedOption, element.query, element.cookie);
            } finally {
                setIsExecuting(false);
            }
        },
        [dispatch, element.action_id, element.cookie, element.data_source, element.query, interactionsDisabled, isExecuting, onAction, postId],
    );

    const isDynamicSource = element.data_source === 'users' || element.data_source === 'channels';
    const optionCount = element.options?.length ?? 0;
    const isValid = Boolean(element.action_id && (isDynamicSource || optionCount > 0) && providers.length > 0);

    if (!isValid) {
        return null;
    }

    return (
        <PostContext.Consumer>
            {({handlePopupOpened}) => (
                <AutocompleteSelector
                    providers={providers}
                    onSelected={handleSelected}
                    placeholder={element.placeholder}
                    inputClassName='mm-blocks-select'
                    value={value}
                    toggleFocus={handlePopupOpened}
                    listPosition='auto'
                    disabled={interactionsDisabled || element.disabled === true || isExecuting}
                />
            )}
        </PostContext.Consumer>
    );
};
