// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getBurnOnReadReadReceipt} from 'selectors/burn_on_read_read_receipts';

import WithTooltip from 'components/with_tooltip';

import type {GlobalState} from 'types/store';

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

    // Get read receipt data from Redux store
    const readReceipt = useSelector((state: GlobalState) => getBurnOnReadReadReceipt(state, postId));

    // TODO: Remove this mock data once backend WebSocket is working
    const mockReadReceipt = {
        postId,
        totalRecipients: 3,
        revealedCount: 1,
        lastUpdated: Date.now(),
    };

    const readReceiptData = isSender && !readReceipt ? mockReadReceipt : readReceipt;

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
            // Show read receipts for sender with delete instruction
            const deleteText = formatMessage({
                id: 'burn_on_read.badge.sender.delete',
                defaultMessage: 'Click to delete message for everyone',
            });

            if (readReceiptData) {
                const readReceiptText = formatMessage(
                    {
                        id: 'burn_on_read.badge.read_receipt',
                        defaultMessage: 'Read by {revealedCount} of {totalRecipients} recipients',
                    },
                    {
                        revealedCount: readReceiptData.revealedCount,
                        totalRecipients: readReceiptData.totalRecipients,
                    },
                );
                return (
                    <div className='BurnOnReadBadge__tooltip-content'>
                        <div className='primary-text'>{deleteText}</div>
                        <div className='secondary-text'>{readReceiptText}</div>
                    </div>
                );
            }

            return deleteText;
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

    // Get plain text for aria-label
    const getAriaLabel = () => {
        if (isSender) {
            const deleteText = formatMessage({
                id: 'burn_on_read.badge.sender.delete',
                defaultMessage: 'Click to delete message for everyone',
            });
            if (readReceiptData) {
                const readReceiptText = formatMessage(
                    {
                        id: 'burn_on_read.badge.read_receipt',
                        defaultMessage: 'Read by {revealedCount} of {totalRecipients} recipients',
                    },
                    {
                        revealedCount: readReceiptData.revealedCount,
                        totalRecipients: readReceiptData.totalRecipients,
                    },
                );
                return `${deleteText}. ${readReceiptText}`;
            }
            return deleteText;
        }
        if (!isSender && !revealed) {
            return formatMessage({
                id: 'burn_on_read.badge.recipient.click_to_reveal',
                defaultMessage: 'Click to Reveal',
            });
        }
        return '';
    };

    const isInteractive = isSender || (!isSender && !revealed);

    return (
        <WithTooltip
            id={`burn-on-read-tooltip-${postId}`}
            title={tooltipContent}
            isVertical={true}
        >
            <button
                type='button'
                className='BurnOnReadBadge'
                data-testid={`burn-on-read-badge-${postId}`}
                aria-label={getAriaLabel()}
                role='button'
                onClick={isInteractive ? handleClick : undefined}
                disabled={!isInteractive}
            >
                <i
                    className='icon icon-fire'
                    aria-hidden='true'
                />
            </button>
        </WithTooltip>
    );
}

export default memo(BurnOnReadBadge);
