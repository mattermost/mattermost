// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {interactiveDialogAppsFormEnabled} from 'mattermost-redux/selectors/entities/interactive_dialog';

import {submitInteractiveDialog} from 'actions/integration_actions';
import {getEmojiMap} from 'selectors/emojis';

import type {GlobalState} from 'types/store';

import InteractiveDialog from './interactive_dialog';
import InteractiveDialogAdapter from './interactive_dialog_adapter';

function mapStateToProps(state: GlobalState) {
    const data = state.entities.integrations.dialog;
    const useAppsForm = interactiveDialogAppsFormEnabled(state);
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
            emojiMap: getEmojiMap(state),
            useAppsForm,
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
        emojiMap: getEmojiMap(state),
        useAppsForm,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            submitInteractiveDialog,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

// Component selector that returns the appropriate implementation
function InteractiveDialogContainer(props: PropsFromRedux & {onExited?: () => void}) {
    if (props.useAppsForm && props.url) {
        return <InteractiveDialogAdapter {...props}/>;
    }
    return <InteractiveDialog {...props}/>;
}

export default connector(InteractiveDialogContainer);
