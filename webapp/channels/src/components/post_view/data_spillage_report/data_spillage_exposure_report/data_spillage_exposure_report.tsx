// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {AlertOutlineIcon} from '@mattermost/compass-icons/components';
import {Button, type ButtonEmphasis} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';

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

    const {icon, label, emphasis, destructive} = useMemo(() => {
        let icon;
        let label;
        let emphasis: ButtonEmphasis = 'tertiary';
        let destructive = false;

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
            icon = <Icon glyph={<AlertOutlineIcon/>}/>;
            label = (
                <FormattedMessage
                    id='data_spillage_report.exposure_report.failed.button_text'
                    defaultMessage='Generation failed. Try again.'
                />
            );
            emphasis = 'primary';
            destructive = true;
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

        return {icon, label, emphasis, destructive};
    }, [status]);

    return (
        <div
            className='DataSpillageExposureReport'
            data-testid='data-spillage-exposure-report'
        >
            <Button
                type='button'
                size='small'
                emphasis={emphasis}
                destructive={destructive}
                onClick={handleClick}
                disabled={status === 'generating'}
                data-testid='data-spillage-action-download-exposure-report'
                leadingIcon={icon}
            >
                {label}
            </Button>
        </div>
    );
}
