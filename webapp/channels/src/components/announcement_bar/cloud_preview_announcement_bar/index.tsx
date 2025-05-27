// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';

import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {trackEvent} from 'actions/telemetry_actions';

import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import {AnnouncementBarTypes} from 'utils/constants';

import AnnouncementBar from '../default_announcement_bar';

const CloudPreviewAnnouncementBar: React.FC = () => {
    const subscription = useSelector(getCloudSubscription);
    const license = useSelector(getLicense);
    const isCloud = license?.Cloud === 'true';
    const [openContactSales] = useOpenSalesLink();

    const [timeLeft, setTimeLeft] = useState<string>('');

    const calculateTimeLeft = useCallback(() => {
        if (!subscription?.end_at) {
            return '';
        }

        const now = Date.now();
        const endTime = subscription.end_at;
        const timeDiff = endTime - now;

        if (timeDiff <= 0) {
            return '00:00';
        }

        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

        // Build time string based on what units are needed
        const parts = [];
        if (days > 0) {
            parts.push(`${days}d`);
        }
        if (hours > 0 || days > 0) {
            parts.push(`${hours.toString().padStart(2, '0')}h`);
        }
        parts.push(`${minutes.toString().padStart(2, '0')}m`);

        return parts.join(' ');
    }, [subscription?.end_at]);

    useEffect(() => {
        if (!subscription?.is_cloud_preview || !isCloud) {
            return undefined;
        }

        // Update immediately
        setTimeLeft(calculateTimeLeft());

        // Update every minute
        const interval = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 60000); // 60 seconds

        return () => clearInterval(interval);
    }, [subscription, isCloud, calculateTimeLeft]);

    const handleContactSalesClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        trackEvent('admin', 'cloud_preview_announcement_bar_contact_sales');
        openContactSales();
    }, [openContactSales]);

    if (!subscription?.is_cloud_preview || !isCloud) {
        return null;
    }

    const message = (
        <FormattedMessage
            id='announcement_bar.cloud_preview.message'
            defaultMessage='This is your Mattermost preview environment. Time left: {timeLeft}'
            values={{timeLeft: timeLeft || '00:00'}}
        />
    );

    const contactSalesText = (
        <FormattedMessage
            id='announcement_bar.cloud_preview.contact_sales'
            defaultMessage='Contact sales'
        />
    );

    return (
        <AnnouncementBar
            type={AnnouncementBarTypes.ADVISOR}
            showCloseButton={false}
            message={message}
            icon={<InformationOutlineIcon size={16}/>}
            showLinkAsButton={true}
            onButtonClick={handleContactSalesClick}
            ctaText={contactSalesText}
        />
    );
};

export default CloudPreviewAnnouncementBar;
