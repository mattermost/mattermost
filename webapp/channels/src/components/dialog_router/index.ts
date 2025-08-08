// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {interactiveDialogAppsFormEnabled} from 'mattermost-redux/selectors/entities/interactive_dialog';

import {submitInteractiveDialog, lookupInteractiveDialog} from 'actions/integration_actions';
import {getEmojiMap} from 'selectors/emojis';

import type {GlobalState} from 'types/store';

import DialogRouter from './dialog_router';

function mapStateToProps(state: GlobalState) {
    const data = state.entities.integrations.dialog;
    const emojiMap = getEmojiMap(state);
    const isAppsFormEnabled = interactiveDialogAppsFormEnabled(state);
    if (!data || !data.dialog) {
        return {
            emojiMap,
            isAppsFormEnabled: false,
            hasUrl: false,
        };
    }

    return {
        url: data.url,
        callbackId: data.dialog.callback_id,
        elements: data.dialog.elements,
        title: data.dialog.title,
        introductionText: data.dialog.introduction_text,
        iconUrl: data.dialog.icon_url,
        submitLabel: data.dialog.submit_label,
        notifyOnCancel: data.dialog.notify_on_cancel,
        state: data.dialog.state,
        emojiMap,
        isAppsFormEnabled,
        hasUrl: Boolean(data.url),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            submitInteractiveDialog,
            lookupInteractiveDialog,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(DialogRouter);
