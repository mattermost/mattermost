// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {BlockDialogButton, DialogElement} from '@mattermost/types/integrations';

import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import {submitInteractiveDialog, lookupInteractiveDialog} from 'actions/integration_actions';
import {getEmojiMap} from 'selectors/emojis';

import type {GlobalState} from 'types/store';

import DialogRouter from './dialog_router';

/** Content-mode props. Always the same keys so mapStateToProps stays a single object type. */
type DialogSelectedProps = {
    url: string | undefined;
    hasUrl: boolean;
    title: string | undefined;
    iconUrl: string | undefined;
    state: string | undefined;
    callbackId: string | undefined;
    elements: DialogElement[] | undefined;
    introductionText: string | undefined;
    submitLabel: string | undefined;
    notifyOnCancel: boolean | undefined;
    sourceUrl: string | undefined;
    mmBlocks: unknown[] | undefined;
    mmBlocksActions: string | undefined;
    blockSubmit: BlockDialogButton | undefined;
    blockCancel: BlockDialogButton | undefined;
};

type DialogRouterStateProps = {
    emojiMap: ReturnType<typeof getEmojiMap>;
    hasUrl: boolean;
    hasMmBlocks: boolean;
    hasContent: boolean;
    mmBlocksEnabled: boolean;
    timezone?: string;
} & Partial<DialogSelectedProps>;

export function mapStateToProps(state: GlobalState, ownProps: {triggerId?: string}): DialogRouterStateProps {
    const data = ownProps.triggerId ? state.entities.integrations.dialogs[ownProps.triggerId] : undefined;
    const emojiMap = getEmojiMap(state);
    const mmBlocksEnabled = getFeatureFlagValue(state, 'MmBlocksEnabled') === 'true';

    if (!data) {
        return {
            emojiMap,
            hasUrl: false,
            hasMmBlocks: false,
            hasContent: false,
            mmBlocksEnabled,
        };
    }

    const blockDialog = data.block_dialog;
    const hasMmBlocks = mmBlocksEnabled && Boolean(blockDialog);
    const hasDialog = Boolean(data.dialog);
    const hasUrl = Boolean(data.url);
    const hasBlocksContent = hasMmBlocks;
    const hasLegacyContent = hasDialog && hasUrl;
    const actionsCookie = typeof blockDialog?.actions === 'string' ? blockDialog.actions : undefined;

    if (!hasBlocksContent && !hasLegacyContent) {
        return {
            emojiMap,
            hasUrl,
            hasMmBlocks,
            hasContent: false,
            mmBlocksEnabled,
        };
    }

    let selectedProps: DialogSelectedProps;
    if (hasBlocksContent) {
        selectedProps = {
            url: undefined,
            hasUrl: false,
            title: blockDialog?.title,
            iconUrl: blockDialog?.icon_url,
            state: blockDialog?.state,
            mmBlocks: blockDialog?.blocks,
            mmBlocksActions: actionsCookie,
            blockSubmit: blockDialog?.submit,
            blockCancel: blockDialog?.cancel,
            callbackId: undefined,
            elements: undefined,
            introductionText: undefined,
            submitLabel: undefined,
            notifyOnCancel: undefined,
            sourceUrl: undefined,
        };
    } else {
        selectedProps = {
            url: data.url,
            hasUrl,
            title: data.dialog?.title,
            iconUrl: data.dialog?.icon_url,
            state: data.dialog?.state,
            callbackId: data.dialog?.callback_id,
            elements: data.dialog?.elements,
            introductionText: data.dialog?.introduction_text,
            submitLabel: data.dialog?.submit_label,
            notifyOnCancel: data.dialog?.notify_on_cancel,
            sourceUrl: data.dialog?.source_url,
            mmBlocks: undefined,
            mmBlocksActions: undefined,
            blockSubmit: undefined,
            blockCancel: undefined,
        };
    }

    return {
        emojiMap,
        hasMmBlocks: hasBlocksContent,
        hasContent: hasBlocksContent || hasLegacyContent,
        mmBlocksEnabled,
        timezone: getCurrentTimezone(state) || undefined,
        ...selectedProps,
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
