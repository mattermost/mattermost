// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';
import {setEncryptionKeyError} from 'actions/views/encryption';
import {ensureEncryptionKeys, checkEncryptionStatus} from 'utils/encryption/session';
import {ModalIdentifiers, Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import KeypairPromptModal from './keypair_prompt_modal';

const KeypairPromptController = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector((state: GlobalState) => getCurrentUser(state));
    const wasDismissed = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_ENCRYPTION, Preferences.NAME_ENCRYPTION_KEYPAIR_MODAL_DISMISSED));

    const handleConfirm = async (dontShowAgain: boolean) => {
        if (dontShowAgain) {
            saveDismissPreference();
        }
        try {
            await ensureEncryptionKeys();
        } catch (error) {
            // Show error bar so user can retry
            dispatch(setEncryptionKeyError(
                error instanceof Error ? error.message : 'Failed to register encryption keys',
            ));
            throw error; // Re-throw so modal can show inline error too
        }
    };

    const handleDismiss = (dontShowAgain: boolean) => {
        if (dontShowAgain) {
            saveDismissPreference();
        }
    };

    const saveDismissPreference = () => {
        if (!currentUser) {
            return;
        }
        dispatch(savePreferences(currentUser.id, [
            {
                category: Preferences.CATEGORY_ENCRYPTION,
                user_id: currentUser.id,
                name: Preferences.NAME_ENCRYPTION_KEYPAIR_MODAL_DISMISSED,
                value: 'true',
            },
        ]));
    };

    useEffect(() => {
        const checkStatus = async () => {
            if (!currentUser || wasDismissed) {
                return;
            }

            try {
                // Always check server status - don't rely only on local sessionStorage
                // This handles the case where local keys exist but server registration failed
                const status = await checkEncryptionStatus();
                if (status.enabled && !status.has_key) {
                    dispatch(openModal({
                        modalId: ModalIdentifiers.KEYPAIR_PROMPT_MODAL,
                        dialogType: KeypairPromptModal,
                        dialogProps: {
                            onConfirm: handleConfirm,
                            onDismiss: handleDismiss,
                        },
                    }));
                }
            } catch (error) {
                // Ignore errors, we'll try again on next mount/update
            }
        };

        checkStatus();
    }, [currentUser, wasDismissed]);

    return null;
};

export default KeypairPromptController;
