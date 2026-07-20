// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import './data_spillage_download_report.scss';

type Props = {
    flaggedPostId: string;
};

type Status = 'idle' | 'generating' | 'error';

export default function DataSpillageDownloadReport({flaggedPostId}: Props) {
    const [status, setStatus] = useState<Status>('idle');
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        // Cleanup function to cancel in-progress API calls
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    const handleClick = useCallback(async () => {
        if (status === 'generating') {
            return;
        }

        const controller = new AbortController();
        abortControllerRef.current?.abort();
        abortControllerRef.current = controller;

        setStatus('generating');

        let blob: Blob | undefined;

        try {
            blob = await Client4.generateFlaggedPostReport(flaggedPostId, '', undefined, controller.signal);
            if (controller.signal.aborted) {
                return;
            }
        } catch (err) {
            if (controller.signal.aborted) {
                return;
            }

            // eslint-disable-next-line no-console
            console.error(err);
            setStatus('error');
            return;
        }

        if (controller.signal.aborted || !blob) {
            return;
        }

        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `flagged-post-${flaggedPostId}-${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadUrl);

        setStatus('idle');
    }, [flaggedPostId, status]);

    let icon;
    let label;
    let buttonClass;

    switch (status) {
    case 'generating':
        icon = <LoadingSpinner/>;
        label = (
            <FormattedMessage
                id='data_spillage_report.download_report.generating.button_text'
                defaultMessage='Generating report…'
            />
        );
        buttonClass = 'btn-tertiary';
        break;
    case 'error':
        icon = <i className='icon icon-alert-outline'/>;
        label = (
            <FormattedMessage
                id='data_spillage_report.download_report.failed.button_text'
                defaultMessage='Generation failed. Try again.'
            />
        );
        buttonClass = 'btn-danger';
        break;
    case 'idle':
    default:
        icon = <i className='icon icon-download-outline'/>;
        label = (
            <FormattedMessage
                id='data_spillage_report.download_report.button_text'
                defaultMessage='Download Report'
            />
        );
        buttonClass = 'btn-tertiary';
        break;
    }

    return (
        <div
            className='DataSpillageDownloadReport'
            data-testid='data-spillage-download-report'
        >
            <button
                type='button'
                className={classNames('btn btn-sm', buttonClass)}
                onClick={handleClick}
                disabled={status === 'generating'}
                data-testid='data-spillage-action-download-report'
            >
                {icon}
                {label}
            </button>
        </div>
    );
}
