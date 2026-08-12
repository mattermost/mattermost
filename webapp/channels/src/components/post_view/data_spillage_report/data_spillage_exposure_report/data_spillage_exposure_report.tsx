// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {Button, type ButtonEmphasis, type ButtonVariant} from '@mattermost/shared/components/button';

import {Client4} from 'mattermost-redux/client';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import './data_spillage_exposure_report.scss';

type Status = 'idle' | 'generating' | 'error';

type Props = {
    flaggedPostId: string;
};

export default function DataSpillageExposureReport({flaggedPostId}: Props) {
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

    const {icon, label, emphasis, variant} = useMemo(() => {
        let icon;
        let label;
        let emphasis: ButtonEmphasis = 'tertiary';
        let variant: ButtonVariant = '';

        switch (status) {
        case 'generating':
            icon = <LoadingSpinner/>;
            label = (
                <FormattedMessage
                    id='data_spillage_report.exposure_report.generating.button_text'
                    defaultMessage='Generating…'
                />
            );
            break;
        case 'error':
            icon = <i className='icon icon-alert-outline'/>;
            label = (
                <FormattedMessage
                    id='data_spillage_report.exposure_report.failed.button_text'
                    defaultMessage='Generation failed. Try again.'
                />
            );

            // Primary emphasis is suppressed by the destructive variant, leaving just btn-danger
            emphasis = 'primary';
            variant = 'destructive';
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
            break;
        }

        return {icon, label, emphasis, variant};
    }, [status]);

    return (
        <div
            className='DataSpillageExposureReport'
            data-testid='data-spillage-exposure-report'
        >
            <Button
                type='button'
                size='sm'
                emphasis={emphasis}
                variant={variant}
                onClick={handleClick}
                disabled={status === 'generating'}
                data-testid='data-spillage-action-download-exposure-report'
            >
                {icon}
                {label}
            </Button>
        </div>
    );
}
