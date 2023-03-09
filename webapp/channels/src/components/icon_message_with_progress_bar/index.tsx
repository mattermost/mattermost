// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import IconMessage from 'components/purchase_modal/icon_message';
import './icon_message_with_progress_bar.scss';

export const enum ProcessState {
    PROCESSING = 0,
    SUCCESS,
    FAILED,
}

type PageCopy = {
    title: string;
    subtitle: string;
    icon: JSX.Element;
    buttonText?: string;
    linkText?: string;
}

type Props = {
    processingState: ProcessState;
    progress: number;
    successPage: () => JSX.Element;
    processingCopy: PageCopy;
    failedCopy: PageCopy;
    handleGoBack: () => void;
    error: boolean;
}

export default function IconMessageWithProgressBar({processingState, progress, successPage, handleGoBack, error, processingCopy, failedCopy}: Props) {
    const progressBar: JSX.Element | null = (
        <div className='IconMessageWithProgressBar-progress'>
            <div
                className='IconMessageWithProgressBar-progress-fill'
                style={{width: `${progress}%`}}
            />
        </div>
    );

    switch (processingState) {
    case ProcessState.PROCESSING:
        return (
            <IconMessage
                footer={progressBar}
                className={'processing'}
                {...processingCopy}
            />
        );
    case ProcessState.SUCCESS:
        return successPage();
    case ProcessState.FAILED:
        return (
            <IconMessage
                {...failedCopy}
                error={error}
                buttonHandler={handleGoBack}
                className={'failed'}
            />
        );
    default:
        return null;
    }
}
