// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';

import {expirationScheduler} from 'utils/burn_on_read_expiration_scheduler';

interface Props {
    postId: string;
    expireAt?: number | null;
    maxExpireAt?: number | null;
}

/**
 * Invisible component that registers burn-on-read posts with the global expiration scheduler.
 * Used for both revealed and unrevealed messages to ensure client-side deletion.
 *
 * - Revealed messages: have expire_at (based on burn_on_read setting and time of reveal)
 * - Unrevealed messages: have max_expire_at (based on bunr_on_read setting and max time to live)
 */
const BurnOnReadExpirationHandler = ({postId, expireAt = null, maxExpireAt = null}: Props) => {
    useEffect(() => {
        // Register post with global expiration scheduler
        expirationScheduler.registerPost(postId, expireAt, maxExpireAt);

        return () => {
            // Unregister when component unmounts (post deleted or navigated away)
            expirationScheduler.unregisterPost(postId);
        };
    }, [postId, expireAt, maxExpireAt]);

    // This component renders nothing - it only handles scheduling
    return null;
};

export default BurnOnReadExpirationHandler;
