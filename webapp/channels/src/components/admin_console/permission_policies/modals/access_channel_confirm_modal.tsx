// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import {Button} from '@mattermost/shared/components/button';

import type {TargetScope} from 'components/admin_console/access_control/modals/simulate_access/role_applicability';

import './access_channel_confirm_modal.scss';

type Props = {
    show: boolean;
    onHide: () => void;
    onConfirm: () => void;
    isSaving?: boolean;
    targetScope: TargetScope;

    // Set when opened from inside another modal (Channel Settings) so this
    // one stacks instead of replacing its parent.
    isStacked?: boolean;
};

/**
 * Save confirmation for a permission policy that carries the `access_channel`
 * action. Denying it hides the channel and its contents from a session
 * without telling the user, so the save needs an explicit confirmation.
 * Policies with only file actions save without one.
 */
export default function AccessChannelConfirmModal({
    show,
    onHide,
    onConfirm,
    targetScope,
    isSaving = false,
    isStacked = false,
}: Props): JSX.Element {
    return (
        <GenericModal
            className='AccessChannelConfirmModal a11y__modal'
            id='access-channel-confirm-modal'
            show={show}
            onHide={onHide}
            onExited={onHide}
            compassDesign={true}
            isStacked={isStacked}
            modalHeaderText={
                <FormattedMessage
                    id='admin.permission_policies.access_channel_confirm.title'
                    defaultMessage='Save this policy?'
                />
            }
            footerContent={
                <div className='AccessChannelConfirmModal__buttons'>
                    <Button
                        emphasis='tertiary'
                        onClick={onHide}
                        disabled={isSaving}
                    >
                        <FormattedMessage
                            id='admin.permission_policies.access_channel_confirm.cancel'
                            defaultMessage='Cancel'
                        />
                    </Button>
                    <Button
                        variant='destructive'
                        onClick={onConfirm}
                        disabled={isSaving}
                    >
                        <FormattedMessage
                            id='admin.permission_policies.access_channel_confirm.confirm'
                            defaultMessage='Save policy'
                        />
                    </Button>
                </div>
            }
        >
            <div className='AccessChannelConfirmModal__body'>
                <p>
                    {targetScope === 'channel' ? (
                        <FormattedMessage
                            id='admin.permission_policies.access_channel_confirm.body_scope_channel'
                            defaultMessage='This policy controls Access Channel for this channel only.'
                        />
                    ) : (
                        <FormattedMessage
                            id='admin.permission_policies.access_channel_confirm.body_scope_workspace'
                            defaultMessage='This policy controls Access Channel across every channel in the workspace, except direct messages and group messages.'
                        />
                    )}
                </p>
                <p>
                    <FormattedMessage
                        id='admin.permission_policies.access_channel_confirm.body_effect'
                        defaultMessage='Any session that does not meet the conditions will lose access to channels covered by this policy.'
                    />
                </p>
                <p>
                    <FormattedMessage
                        id='admin.permission_policies.access_channel_confirm.body_simulate'
                        defaultMessage='Run Simulate rules first if you have not confirmed who this affects.'
                    />
                </p>
            </div>
        </GenericModal>
    );
}
