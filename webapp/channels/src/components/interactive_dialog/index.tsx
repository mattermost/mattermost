// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {submitInteractiveDialog, lookupInteractiveDialog} from 'actions/integration_actions';
import {getEmojiMap} from 'selectors/emojis';

import DialogRouter from 'components/dialog_router';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    const data = state.entities.integrations.dialog;
    if (!data || !data.dialog) {
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
            sourceUrl: undefined, // NEW: Default to undefined when no dialog data
            emojiMap: getEmojiMap(state),
        };
    }

    return {
        url: data.url || '',
        callbackId: data.dialog.callback_id,
        elements: data.dialog.elements,
        title: data.dialog.title || '',
        introductionText: data.dialog.introduction_text,
        iconUrl: data.dialog.icon_url,
        submitLabel: data.dialog.submit_label,
        notifyOnCancel: data.dialog.notify_on_cancel,
        state: data.dialog.state,
        sourceUrl: data.dialog.source_url, // NEW: Pass source_url for form refresh functionality
        emojiMap: getEmojiMap(state),
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

// Use DialogRouter which dynamically selects the appropriate implementation
function InteractiveDialogContainer(props: PropsFromRedux & {onExited?: () => void}) {
    return <DialogRouter {...props}/>;
}

export default connector(InteractiveDialogContainer);
