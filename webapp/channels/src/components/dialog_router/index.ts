// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {submitInteractiveDialog, lookupInteractiveDialog} from 'mattermost-redux/actions/integrations';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import {getEmojiMap} from 'selectors/emojis';

import type {GlobalState} from 'types/store';

import DialogRouter from './dialog_router';

function mapStateToProps(state: GlobalState, ownProps: {triggerId?: string}) {
    const data = ownProps.triggerId ? state.entities.integrations.dialogs[ownProps.triggerId] : undefined;
    const emojiMap = getEmojiMap(state);
    if (!data || !data.dialog) {
        return {
            emojiMap,
            hasUrl: false,
        };
    }

    return {

        // The channel the trigger was created in, resolved by the server and sent with
        // the dialog. The server is the only party that knows it for dialogs this client
        // never initiated, such as a command a plugin ran server-side.
        //
        // Absent for a trigger minted by a node that predates it, and for dialogs a
        // plugin injects client-side via window.openInteractiveDialog, which never
        // round-trip the server. Both cases fall back to the current channel in the
        // submit and lookup actions.
        channelId: data.channel_id,
        url: data.url,
        callbackId: data.dialog.callback_id,
        elements: data.dialog.elements,
        title: data.dialog.title,
        introductionText: data.dialog.introduction_text,
        iconUrl: data.dialog.icon_url,
        submitLabel: data.dialog.submit_label,
        notifyOnCancel: data.dialog.notify_on_cancel,
        state: data.dialog.state,
        sourceUrl: data.dialog.source_url,
        emojiMap,
        hasUrl: Boolean(data.url),
        timezone: getCurrentTimezone(state) || undefined,
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
