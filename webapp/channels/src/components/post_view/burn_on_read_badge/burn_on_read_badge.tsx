// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import './burn_on_read_badge.scss';

type Props = {
    postId: string;
    isSender: boolean;
    revealed: boolean;
    onReveal?: (postId: string) => void;
    onSenderDelete?: () => void;
};

function BurnOnReadBadge({
    postId,
    isSender,
    revealed,
    onReveal,
    onSenderDelete,
}: Props) {
    const {formatMessage} = useIntl();

    const handleClick = useCallback((e: React.MouseEvent) => {
        // Stop propagation to prevent opening RHS or other post click handlers
        e.stopPropagation();
        e.preventDefault();

        // For sender, show delete confirmation modal
        if (isSender && onSenderDelete) {
            onSenderDelete();
            return;
        }

        // For recipients with unrevealed content, trigger reveal
        if (!isSender && !revealed && onReveal) {
            onReveal(postId);
        }
    }, [isSender, revealed, onReveal, onSenderDelete, postId]);

    const getTooltipContent = () => {
        if (isSender) {
            return formatMessage({
                id: 'burn_on_read.badge.sender.delete',
                defaultMessage: 'Click to delete message for everyone',
            });
        }

        if (!isSender && !revealed) {
            // Recipient sees "Click to Reveal" before revealing
            return formatMessage({
                id: 'burn_on_read.badge.recipient.click_to_reveal',
                defaultMessage: 'Click to Reveal',
            });
        }

        // For revealed recipient posts, timer chip will be shown separately (next PR)
        return null;
    };

    const tooltipContent = getTooltipContent();

    // Don't render anything if there's no tooltip content
    if (!tooltipContent) {
        return null;
    }

    return (
        <WithTooltip
            id={`burn-on-read-tooltip-${postId}`}
            title={<div style={{whiteSpace: 'pre-line'}}>{tooltipContent}</div>}
            isVertical={true}
        >
            <span
                className='BurnOnReadBadge'
                data-testid={`burn-on-read-badge-${postId}`}
                aria-label={tooltipContent}
                onClick={handleClick}
                role={(isSender || (!isSender && !revealed)) ? 'button' : undefined}
                style={{cursor: (isSender || (!isSender && !revealed)) ? 'pointer' : 'default'}}
            >
                <i
                    className='icon icon-fire'
                    aria-hidden='true'
                />
            </span>
        </WithTooltip>
    );
}

export default memo(BurnOnReadBadge);
