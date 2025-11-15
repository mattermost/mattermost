// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';

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

function BurnOnReadConcealedPlaceholder({
    postId,
    authorName,
    onReveal,
    loading = false,
    error = null,
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
        <div
            className={`BurnOnReadConcealedPlaceholder ${loading ? 'BurnOnReadConcealedPlaceholder--loading' : ''} ${error ? 'BurnOnReadConcealedPlaceholder--error' : ''}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role='button'
            tabIndex={0}
            aria-label={ariaLabel}
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
        </div>
    );
}

export default memo(BurnOnReadConcealedPlaceholder);
