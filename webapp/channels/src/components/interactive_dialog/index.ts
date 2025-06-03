// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {submitInteractiveDialog} from 'mattermost-redux/actions/integrations';

import {doAppSubmit, doAppFetchForm, doAppLookup, postEphemeralCallResponseForContext} from 'actions/apps';
import {autocompleteChannels} from 'actions/channel_actions';
import {autocompleteUsers} from 'actions/user_actions';
import {getEmojiMap} from 'selectors/emojis';

import type {GlobalState} from 'types/store';

import InteractiveDialogAdapter from './interactive_dialog_adapter';

function mapStateToProps(state: GlobalState) {
    const data = state.entities.integrations.dialog;
    if (!data || !data.dialog) {
        // Provide default values for all required props
        return {
            url: '',
            callbackId: undefined,
            elements: undefined,
            title: '',
            introductionText: undefined,
            iconUrl: undefined,
            submitLabel: undefined,
            notifyOnCancel: undefined,
            state: undefined,
            emojiMap: getEmojiMap(state),
        };
    }

    return {
        url: data.url ?? '',
        callbackId: data.dialog.callback_id,
        elements: data.dialog.elements,
        title: data.dialog.title ?? '',
        introductionText: data.dialog.introduction_text,
        iconUrl: data.dialog.icon_url,
        submitLabel: data.dialog.submit_label,
        notifyOnCancel: data.dialog.notify_on_cancel,
        state: data.dialog.state,
        emojiMap: getEmojiMap(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            submitInteractiveDialog,
            doAppSubmit,
            doAppFetchForm,
            doAppLookup,
            postEphemeralCallResponseForContext,
            autocompleteChannels,
            autocompleteUsers,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(InteractiveDialogAdapter);
