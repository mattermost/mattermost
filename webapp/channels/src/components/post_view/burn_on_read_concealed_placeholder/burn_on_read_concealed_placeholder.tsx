// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';

import {EyeOutlineIcon, AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import './burn_on_read_concealed_placeholder.scss';

type Props = {
    postId: string;
    authorName: string;
    onReveal: (postId: string) => void;
    loading?: boolean;
    error?: string | null;
};

const ERROR_STATE_DURATION_MS = 3000;

function BurnOnReadConcealedPlaceholder({
    postId,
    authorName,
    onReveal,
    loading = false,
    error = null,
}: Props) {
    const {formatMessage} = useIntl();
    const [showError, setShowError] = useState(false);

    useEffect(() => {
        if (error) {
            setShowError(true);
            const timer = setTimeout(() => {
                setShowError(false);
            }, ERROR_STATE_DURATION_MS);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [error]);

    const handleClick = useCallback(() => {
        if (!loading && !showError) {
            onReveal(postId);
        }
    }, [postId, onReveal, loading, showError]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((isKeyPressed(e, Constants.KeyCodes.ENTER) || isKeyPressed(e, Constants.KeyCodes.SPACE)) && !loading && !showError) {
            e.preventDefault();
            onReveal(postId);
        }
    }, [postId, onReveal, loading, showError]);

    const ariaLabel = formatMessage(
        {
            id: 'burn_on_read.concealed.aria_label',
            defaultMessage: 'Burn-on-read message from {author}. Click to reveal content.',
        },
        {author: authorName},
    );

    return (
        <>
            {showError ? (
                <div
                    className='BurnOnReadConcealedPlaceholder BurnOnReadConcealedPlaceholder--error'
                    role='alert'
                >
                    <div className='BurnOnReadConcealedPlaceholder__content'>
                        <AlertCircleOutlineIcon
                            size={12}
                            className='BurnOnReadConcealedPlaceholder__icon BurnOnReadConcealedPlaceholder__icon--error'
                        />
                        <span className='BurnOnReadConcealedPlaceholder__text BurnOnReadConcealedPlaceholder__text--error'>
                            {formatMessage({
                                id: 'post.burn_on_read.reveal_error',
                                defaultMessage: 'Unable to reveal message. Please try again later.',
                            })}
                        </span>
                    </div>
                </div>
            ) : (
                <button
                    type='button'
                    className={`BurnOnReadConcealedPlaceholder ${loading ? 'BurnOnReadConcealedPlaceholder--loading' : ''}`}
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    aria-label={ariaLabel}
                    tabIndex={0}
                    data-testid={`burn-on-read-concealed-${postId}`}
                >
                    {loading ? (
                        <LoadingSpinner/>
                    ) : (
                        <div className='BurnOnReadConcealedPlaceholder__content'>
                            <EyeOutlineIcon
                                size={12}
                                className='BurnOnReadConcealedPlaceholder__icon'
                            />
                            <span className='BurnOnReadConcealedPlaceholder__text'>
                                {formatMessage({
                                    id: 'post.burn_on_read.view_message',
                                    defaultMessage: 'View message',
                                })}
                            </span>
                        </div>
                    )}
                </button>
            )}
        </>
    );
}

export default memo(BurnOnReadConcealedPlaceholder);
