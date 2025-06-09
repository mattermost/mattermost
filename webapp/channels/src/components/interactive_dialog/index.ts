// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {submitInteractiveDialog} from 'actions/integration_actions';
import {getEmojiMap} from 'selectors/emojis';

import type {GlobalState} from 'types/store';

import InteractiveDialog from './interactive_dialog';

function mapStateToProps(state: GlobalState) {
    const data = state.entities.integrations.dialog;
    if (!data || !data.dialog) {
        return {};
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
        emojiMap: getEmojiMap(state),
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

export default connector(InteractiveDialog);
