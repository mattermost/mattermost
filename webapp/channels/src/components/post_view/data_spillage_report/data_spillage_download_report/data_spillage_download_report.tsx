// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {AlertOutlineIcon, DownloadOutlineIcon} from '@mattermost/compass-icons/components';
import {Button, type ButtonEmphasis} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';

import {Client4} from 'mattermost-redux/client';

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

    const {icon, label, emphasis, destructive} = useMemo(() => {
        let icon;
        let label;
        let emphasis: ButtonEmphasis = 'tertiary';
        let destructive = false;

        switch (status) {
        case 'generating':
            label = (
                <FormattedMessage
                    id='data_spillage_report.download_report.generating.button_text'
                    defaultMessage='Generating report…'
                />
            );
            break;
        case 'error':
            icon = <Icon glyph={<AlertOutlineIcon/>}/>;
            label = (
                <FormattedMessage
                    id='data_spillage_report.download_report.failed.button_text'
                    defaultMessage='Generation failed. Try again.'
                />
            );
            emphasis = 'primary';
            destructive = true;
            break;
        case 'idle':
        default:
            icon = <Icon glyph={<DownloadOutlineIcon/>}/>;
            label = (
                <FormattedMessage
                    id='data_spillage_report.download_report.button_text'
                    defaultMessage='Download Report'
                />
            );
            break;
        }

        return {icon, label, emphasis, destructive};
    }, [status]);

    return (
        <div
            className='DataSpillageDownloadReport'
            data-testid='data-spillage-download-report'
        >
            <Button
                type='button'
                size='small'
                emphasis={emphasis}
                destructive={destructive}
                onClick={handleClick}
                disabled={status === 'generating'}
                loading={status === 'generating'}
                data-testid='data-spillage-action-download-report'
                leadingIcon={icon}
            >
                {label}
            </Button>
        </div>
    );
}
