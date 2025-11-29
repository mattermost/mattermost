// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';

import BurnOnReadExpirationHandler from 'components/post_view/burn_on_read_expiration_handler';
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
    maxExpireAt?: number;
};

function BurnOnReadConcealedPlaceholder({
    postId,
    authorName,
    onReveal,
    loading = false,
    error = null,
    maxExpireAt,
}: Props) {
    const {formatMessage} = useIntl();

    const handleClick = useCallback(() => {
        if (!loading) {
            onReveal(postId);
        }
    }, [postId, onReveal, loading]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((isKeyPressed(e, Constants.KeyCodes.ENTER) || isKeyPressed(e, Constants.KeyCodes.SPACE)) && !loading) {
            e.preventDefault();
            onReveal(postId);
        }
    }, [postId, onReveal, loading]);

    const ariaLabel = formatMessage(
        {
            id: 'burn_on_read.concealed.aria_label',
            defaultMessage: 'Burn-on-read message from {author}. Click to reveal content.',
        },
        {author: authorName},
    );

    return (
        <>
            {/* Register with expiration scheduler for max_expire_at tracking */}
            <BurnOnReadExpirationHandler
                postId={postId}
                maxExpireAt={maxExpireAt}
            />

            <button
                type='button'
                className={`BurnOnReadConcealedPlaceholder ${loading ? 'BurnOnReadConcealedPlaceholder--loading' : ''} ${error ? 'BurnOnReadConcealedPlaceholder--error' : ''}`}
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
                    <div
                        className='BurnOnReadConcealedPlaceholder__text'
                        aria-hidden='true'
                    >
                        {formatMessage({
                            id: 'post.burn_on_read.concealed_placeholder',
                            defaultMessage: 'This message is concealed and will be revealed when you click on it to view the content',
                        })}
                    </div>
                )}

                {error && (
                    <div
                        className='BurnOnReadConcealedPlaceholder__error'
                        role='alert'
                    >
                        {error}
                    </div>
                )}
            </button>
        </>
    );
}

export default memo(BurnOnReadConcealedPlaceholder);
