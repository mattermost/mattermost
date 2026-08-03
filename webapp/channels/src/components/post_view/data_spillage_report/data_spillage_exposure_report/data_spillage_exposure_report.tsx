// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import './data_spillage_exposure_report.scss';

type Props = {
    flaggedPostId: string;

    /**
     * The server refuses to generate an exposure report once the post's review is closed,
     * so the action is replaced with an explanation in that case.
     */
    isActionable: boolean;
};

type Status = 'idle' | 'generating' | 'error';

export default function DataSpillageExposureReport({flaggedPostId, isActionable}: Props) {
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

        let report: {blob: Blob; filename: string} | undefined;

        try {
            report = await Client4.generatePostExposureReport(flaggedPostId, controller.signal);
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

        if (controller.signal.aborted || !report) {
            return;
        }

        const downloadUrl = URL.createObjectURL(report.blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = report.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadUrl);

        setStatus('idle');
    }, [flaggedPostId, status]);

    if (!isActionable) {
        return (
            <div
                className='DataSpillageExposureReport'
                data-testid='data-spillage-exposure-report'
            >
                <span
                    className='DataSpillageExposureReport__unavailable'
                    data-testid='data-spillage-exposure-report-unavailable'
                >
                    <i className='icon icon-information-outline'/>
                    <FormattedMessage
                        id='data_spillage_report.exposure_report.unavailable'
                        defaultMessage='Exposure report is no longer available for this message.'
                    />
                </span>
            </div>
        );
    }

    let icon;
    let label;
    let buttonClass;

    switch (status) {
    case 'generating':
        icon = <LoadingSpinner/>;
        label = (
            <FormattedMessage
                id='data_spillage_report.exposure_report.generating.button_text'
                defaultMessage='Generating…'
            />
        );
        buttonClass = 'btn-tertiary';
        break;
    case 'error':
        icon = <i className='icon icon-alert-outline'/>;
        label = (
            <FormattedMessage
                id='data_spillage_report.exposure_report.failed.button_text'
                defaultMessage='Generation failed. Try again.'
            />
        );
        buttonClass = 'btn-danger';
        break;
    case 'idle':
    default:
        icon = null;
        label = (
            <FormattedMessage
                id='data_spillage_report.exposure_report.button_text'
                defaultMessage='Download exposure report'
            />
        );
        buttonClass = 'btn-tertiary';
        break;
    }

    return (
        <div
            className='DataSpillageExposureReport'
            data-testid='data-spillage-exposure-report'
        >
            <button
                type='button'
                className={classNames('btn btn-sm', buttonClass)}
                onClick={handleClick}
                disabled={status === 'generating'}
                data-testid='data-spillage-action-download-exposure-report'
            >
                {icon}
                {label}
            </button>
        </div>
    );
}
