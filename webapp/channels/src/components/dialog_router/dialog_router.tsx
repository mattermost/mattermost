// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import BlocksDialogShell from './blocks_dialog_shell';
import InteractiveDialogAdapter from './interactive_dialog_adapter';

import type {PropsFromRedux} from './index';

type OptionalPropsFromRedux = Partial<PropsFromRedux> & Pick<PropsFromRedux, 'emojiMap' | 'hasContent' | 'actions'>;

type Props = OptionalPropsFromRedux & {
    onExited?: () => void;
};

const DialogRouter: React.FC<Props> = (props) => {
    const {hasContent, hasMmBlocks, hasUrl, mmBlocksEnabled = true} = props;

    if (!hasContent) {
        // eslint-disable-next-line no-console
        console.error('Interactive dialog missing URL or block_dialog - this is a configuration error');
        return null;
    }

    // Native block dialogs do not require a URL.
    if (mmBlocksEnabled && hasMmBlocks) {
        return (
            <BlocksDialogShell
                mode='native'
                title={props.title}
                iconUrl={props.iconUrl}
                state={props.state}
                blockSubmit={props.blockSubmit}
                blockCancel={props.blockCancel}
                mmBlocks={props.mmBlocks}
                mmBlocksActions={typeof props.mmBlocksActions === 'string' ? props.mmBlocksActions : undefined}
                onExited={props.onExited}
            />
        );
    }

    if (!hasUrl) {
        // eslint-disable-next-line no-console
        console.error('Interactive dialog missing URL - this is a configuration error');
        return null;
    }

    // When MmBlocksEnabled is off, use the pre-Blocks AppsForm path for legacy dialogs.
    if (!mmBlocksEnabled) {
        return (
            <InteractiveDialogAdapter
                url={props.url}
                callbackId={props.callbackId}
                elements={props.elements}
                title={props.title}
                introductionText={props.introductionText}
                iconUrl={props.iconUrl}
                submitLabel={props.submitLabel}
                notifyOnCancel={props.notifyOnCancel}
                state={props.state}
                sourceUrl={props.sourceUrl}
                timezone={props.timezone}
                actions={props.actions}
                onExited={props.onExited}
            />
        );
    }

    return (
        <BlocksDialogShell
            mode='legacy'
            url={props.url}
            callbackId={props.callbackId}
            elements={props.elements}
            title={props.title}
            introductionText={props.introductionText}
            iconUrl={props.iconUrl}
            submitLabel={props.submitLabel}
            notifyOnCancel={props.notifyOnCancel}
            state={props.state}
            sourceUrl={props.sourceUrl}
            actions={props.actions}
            onExited={props.onExited}
        />
    );
};

export default DialogRouter;
