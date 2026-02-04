// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {setEncryptionKeyError} from 'actions/views/encryption';
import {ensureEncryptionKeys, checkEncryptionStatus} from 'utils/encryption/session';
import {hasEncryptionKeys} from 'utils/encryption/storage';

import type {GlobalState} from 'types/store';

/**
 * Controller that automatically generates encryption keys when a user logs in.
 * Keys are generated per-session and registered with the server.
 * No popup is shown - key generation happens silently in the background.
 */
const KeypairPromptController = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector((state: GlobalState) => getCurrentUser(state));
    const hasAttemptedRef = useRef(false);

    useEffect(() => {
        const autoGenerateKeys = async () => {
            if (!currentUser) {
                return;
            }

            // Only attempt once per session to avoid infinite loops on error
            if (hasAttemptedRef.current) {
                return;
            }

            try {
                // Check if encryption is enabled and we need to generate keys
                const status = await checkEncryptionStatus();

                if (!status.enabled) {
                    // Encryption not enabled, nothing to do
                    return;
                }

                if (status.has_key && hasEncryptionKeys(status.session_id)) {
                    // Server has key AND client has local keys, nothing to do
                    return;
                }

                // If server has key but client doesn't, we need to regenerate
                // (client lost keys due to cleared browser data, different browser, etc.)
                if (status.has_key && !hasEncryptionKeys(status.session_id)) {
                    console.log('[KeypairPromptController] Server has key but client missing local keys, regenerating...');
                }

                // Mark that we've attempted key generation
                hasAttemptedRef.current = true;

                console.log('[KeypairPromptController] Auto-generating encryption keys for session');

                // Auto-generate and register keys
                await ensureEncryptionKeys();

                console.log('[KeypairPromptController] Successfully generated and registered encryption keys');
            } catch (error) {
                console.error('[KeypairPromptController] Failed to auto-generate encryption keys:', error);
                // Show error bar so user knows something went wrong
                dispatch(setEncryptionKeyError(
                    error instanceof Error ? error.message : 'Failed to register encryption keys',
                ));
            }
        };

        autoGenerateKeys();
    }, [currentUser, dispatch]);

    // Reset the attempt flag when user changes (logs out and back in)
    useEffect(() => {
        hasAttemptedRef.current = false;
    }, [currentUser?.id]);

    return null;
};

export default KeypairPromptController;
