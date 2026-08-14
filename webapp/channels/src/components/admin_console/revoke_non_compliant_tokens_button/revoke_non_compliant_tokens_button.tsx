// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import AlertBanner from 'components/alert_banner';
import ConfirmModal from 'components/confirm_modal';

type SaveAction = () => Promise<{error?: {message?: string}}>;

type Props = {

    // True when the surrounding setting is read-only for this admin.
    disabled?: boolean;

    // System Console save-action hooks. Registered actions run after the config
    // has been persisted, so we use one to refresh the count once the admin
    // saves a new policy.
    registerSaveAction?: (saveAction: SaveAction) => void;
    unRegisterSaveAction?: (saveAction: SaveAction) => void;
};

// RevokeNonCompliantTokensButton lets an admin bulk-revoke every personal access
// token that violates the configured MaximumPersonalAccessTokenLifetimeDays
// policy. The non-compliant count comes from the server (the source of truth for
// the persisted policy) and is shown up front, refreshed after a save, and after
// a revoke, so the blast radius is visible without clicking and the button is
// disabled when there is nothing to revoke. The remaining click always confirms
// the irreversible hard-delete first, satisfying MM-69075.
const RevokeNonCompliantTokensButton = ({disabled, registerSaveAction, unRegisterSaveAction}: Props) => {
    const [showConfirm, setShowConfirm] = useState(false);
    const [busy, setBusy] = useState(false);

    // null = not yet loaded; a number once the count has been fetched.
    const [count, setCount] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [revokedCount, setRevokedCount] = useState<number | null>(null);

    const refreshCount = useCallback(async () => {
        try {
            const {count: nonCompliant} = await Client4.getNonCompliantUserAccessTokenCount();
            setCount(nonCompliant);
            setError('');
        } catch (err) {
            setError(err instanceof Error ? err.message : '');
        }
    }, []);

    // Load the count when the setting renders, and register a save action so it
    // refreshes right after the admin saves a new policy (patchConfig has
    // already persisted by the time save actions run, so the server returns the
    // count for the new policy).
    useEffect(() => {
        refreshCount();

        const saveAction: SaveAction = async () => {
            setRevokedCount(null);
            await refreshCount();
            return {};
        };
        registerSaveAction?.(saveAction);
        return () => unRegisterSaveAction?.(saveAction);
    }, [refreshCount, registerSaveAction, unRegisterSaveAction]);

    const handleConfirm = useCallback(async () => {
        setBusy(true);
        try {
            const {count: revoked} = await Client4.revokeNonCompliantUserAccessTokens();
            setRevokedCount(revoked);
            setCount(0);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
            setShowConfirm(false);
        }
    }, []);

    const openConfirm = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setError('');
        setRevokedCount(null);
        setShowConfirm(true);
    }, []);

    const handleCancel = useCallback(() => setShowConfirm(false), []);

    const nothingToRevoke = count === null || count === 0;

    return (
        <div
            className='RevokeNonCompliantTokensButton'
            style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px'}}
        >
            <button
                type='button'
                className='btn btn-tertiary'
                disabled={disabled || busy || nothingToRevoke}
                onClick={openConfirm}
            >
                <FormattedMessage
                    id='admin.service.revokeNonCompliantTokens.button'
                    defaultMessage='Revoke non-compliant tokens'
                />
            </button>
            {error && (
                <AlertBanner
                    mode='danger'
                    message={(
                        <FormattedMessage
                            id='admin.service.revokeNonCompliantTokens.error'
                            defaultMessage='Unable to revoke non-compliant tokens: {error}'
                            values={{error}}
                        />
                    )}
                />
            )}
            {!error && revokedCount !== null && (
                <AlertBanner
                    mode='success'
                    message={(
                        <FormattedMessage
                            id='admin.service.revokeNonCompliantTokens.success'
                            defaultMessage='Revoked {count, number} non-compliant personal access {count, plural, one {token} other {tokens}}.'
                            values={{count: revokedCount}}
                        />
                    )}
                />
            )}
            {!error && revokedCount === null && count !== null && (
                <AlertBanner
                    mode={count > 0 ? 'danger' : 'success'}
                    message={count > 0 ? (
                        <FormattedMessage
                            id='admin.service.revokeNonCompliantTokens.count'
                            defaultMessage='{count, number} personal access {count, plural, one {token} other {tokens}} currently {count, plural, one {violates} other {violate}} the maximum lifetime policy.'
                            values={{count}}
                        />
                    ) : (
                        <FormattedMessage
                            id='admin.service.revokeNonCompliantTokens.none'
                            defaultMessage='No personal access tokens currently need to be revoked.'
                        />
                    )}
                />
            )}
            <ConfirmModal
                show={showConfirm}
                title={(
                    <FormattedMessage
                        id='admin.service.revokeNonCompliantTokens.confirmTitle'
                        defaultMessage='Revoke non-compliant personal access tokens?'
                    />
                )}
                message={(
                    <FormattedMessage
                        id='admin.service.revokeNonCompliantTokens.confirmBody'
                        defaultMessage='This will permanently revoke {count, number} personal access {count, plural, one {token} other {tokens}} that {count, plural, one {does} other {do}} not comply with the current maximum lifetime policy. This cannot be undone. Bot account tokens are not affected.'
                        values={{count: count ?? 0}}
                    />
                )}
                confirmButtonVariant='destructive'
                confirmButtonText={(
                    <FormattedMessage
                        id='admin.service.revokeNonCompliantTokens.confirmButton'
                        defaultMessage='Revoke tokens'
                    />
                )}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </div>
    );
};

export default React.memo(RevokeNonCompliantTokensButton);
