// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {FireIcon} from '@mattermost/compass-icons/components';

import WithTooltip from 'components/with_tooltip';

import {useBurnOnReadTimer} from 'hooks/useBurnOnReadTimer';
import {getAriaAnnouncementInterval, formatAriaAnnouncement} from 'utils/burn_on_read_timer_utils';
import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import './burn_on_read_timer_chip.scss';

interface Props {
    expireAt?: number;
    onClick: () => void;
}

const BurnOnReadTimerChip = ({expireAt, onClick}: Props) => {
    const {formatMessage} = useIntl();
    const [lastAnnouncement, setLastAnnouncement] = useState<number>(0);

    const {displayText, remainingMs, isWarning, isExpired} = useBurnOnReadTimer({
        expireAt: expireAt || Date.now(),
    });

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    }, [onClick]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (isKeyPressed(e, Constants.KeyCodes.ENTER) || isKeyPressed(e, Constants.KeyCodes.SPACE)) {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        }
    }, [onClick]);

    const ariaLiveRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const now = Date.now();
        const announcementInterval = getAriaAnnouncementInterval(remainingMs);

        if (now - lastAnnouncement >= announcementInterval) {
            setLastAnnouncement(now);
            if (ariaLiveRef.current) {
                ariaLiveRef.current.textContent = formatAriaAnnouncement(remainingMs);
            }
        }
    }, [remainingMs, lastAnnouncement]);

    const ariaLabel = useMemo(() => formatMessage(
        {
            id: 'post.burn_on_read.timer.aria_label',
            defaultMessage: 'Burn-on-read timer: {time}. Click to delete now.',
        },
        {time: displayText},
    ), [formatMessage, displayText]);

    const tooltipContent = useMemo(() => (
        <div className='BurnOnReadTimerChip__tooltip'>
            <div className='BurnOnReadTimerChip__tooltip-primary'>
                {formatMessage(
                    {
                        id: 'post.burn_on_read.timer.tooltip.line1',
                        defaultMessage: 'Deletes in {time}',
                    },
                    {time: displayText},
                )}
            </div>
            <div className='BurnOnReadTimerChip__tooltip-secondary'>
                {formatMessage({
                    id: 'post.burn_on_read.timer.tooltip.line2',
                    defaultMessage: 'Click here to delete immediately',
                })}
            </div>
        </div>
    ), [formatMessage, displayText]);

    return (
        <>
            <WithTooltip title={tooltipContent}>
                <button
                    type='button'
                    className={`BurnOnReadTimerChip ${isWarning ? 'BurnOnReadTimerChip--warning' : ''} ${isExpired ? 'BurnOnReadTimerChip--expired' : ''}`}
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                    aria-label={ariaLabel}
                >
                    <FireIcon
                        size={10}
                        className='BurnOnReadTimerChip__icon'
                    />
                    <span className='BurnOnReadTimerChip__time'>{displayText}</span>
                </button>
            </WithTooltip>
            <div
                ref={ariaLiveRef}
                className='sr-only'
                aria-live='polite'
                aria-atomic='true'
            />
        </>
    );
};

export default memo(BurnOnReadTimerChip);
