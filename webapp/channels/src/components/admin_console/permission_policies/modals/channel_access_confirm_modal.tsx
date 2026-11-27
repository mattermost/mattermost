// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import {Button} from '@mattermost/shared/components/button';
import {ACCESS_CONTROL_ACTION_CHANNEL_MANAGEMENT_ACCESS, ACCESS_CONTROL_ACTION_CHANNEL_READ_ACCESS} from '@mattermost/types/access_control';

import type {TargetScope} from 'components/admin_console/access_control/modals/simulate_access/role_applicability';

import './channel_access_confirm_modal.scss';

type Props = {
    show: boolean;
    onHide: () => void;
    onConfirm: () => void;
    isSaving?: boolean;
    targetScope: TargetScope;

    // The confirmable actions the policy carries: channel_read_access,
    // channel_management_access or both. Each gets its own scope and effect copy.
    actions: string[];

    // Set when opened from inside another modal (Channel Settings) so this
    // one stacks instead of replacing its parent.
    isStacked?: boolean;
};

/**
 * Save confirmation for a permission policy that carries the `channel_read_access` or
 * `channel_management_access` action. Denying the first hides the channel and its
 * contents from a session without telling the user; denying the second can take away
 * the author's own ability to edit the policy. Either way the save needs an explicit
 * confirmation. Policies with only other actions save without one.
 */
export default function ChannelAccessConfirmModal({
    show,
    onHide,
    onConfirm,
    targetScope,
    actions,
    isSaving = false,
    isStacked = false,
}: Props): JSX.Element {
    return (
        <GenericModal
            className='ChannelAccessConfirmModal a11y__modal'
            id='channel-access-confirm-modal'
            show={show}
            onHide={onHide}
            onExited={onHide}
            compassDesign={true}
            isStacked={isStacked}
            modalHeaderText={
                <FormattedMessage
                    id='admin.permission_policies.channel_read_access_confirm.title'
                    defaultMessage='Save this policy?'
                />
            }
            footerContent={
                <div className='ChannelAccessConfirmModal__buttons'>
                    <Button
                        emphasis='tertiary'
                        onClick={onHide}
                        disabled={isSaving}
                    >
                        <FormattedMessage
                            id='admin.permission_policies.channel_read_access_confirm.cancel'
                            defaultMessage='Cancel'
                        />
                    </Button>
                    <Button
                        variant='destructive'
                        onClick={onConfirm}
                        disabled={isSaving}
                    >
                        <FormattedMessage
                            id='admin.permission_policies.channel_read_access_confirm.confirm'
                            defaultMessage='Save policy'
                        />
                    </Button>
                </div>
            }
        >
            <div className='ChannelAccessConfirmModal__body'>
                {actions.includes(ACCESS_CONTROL_ACTION_CHANNEL_READ_ACCESS) && (
                    <>
                        <p>
                            {targetScope === 'channel' ? (
                                <FormattedMessage
                                    id='admin.permission_policies.channel_read_access_confirm.body_scope_channel'
                                    defaultMessage='This policy controls Channel Read Access for this channel only.'
                                />
                            ) : (
                                <FormattedMessage
                                    id='admin.permission_policies.channel_read_access_confirm.body_scope_workspace'
                                    defaultMessage='This policy controls Channel Read Access across every channel in the workspace, except direct messages and group messages.'
                                />
                            )}
                        </p>
                        <p>
                            <FormattedMessage
                                id='admin.permission_policies.channel_read_access_confirm.body_effect'
                                defaultMessage='Any session that does not meet the conditions will lose access to channels covered by this policy.'
                            />
                        </p>
                    </>
                )}
                {actions.includes(ACCESS_CONTROL_ACTION_CHANNEL_MANAGEMENT_ACCESS) && (
                    <>
                        <p>
                            {targetScope === 'channel' ? (
                                <FormattedMessage
                                    id='admin.permission_policies.channel_management_access_confirm.body_scope_channel'
                                    defaultMessage='This policy controls Manage Channel for this channel only.'
                                />
                            ) : (
                                <FormattedMessage
                                    id='admin.permission_policies.channel_management_access_confirm.body_scope_workspace'
                                    defaultMessage='This policy controls Manage Channel across every channel in the workspace, except direct messages and group messages.'
                                />
                            )}
                        </p>
                        <p>
                            <FormattedMessage
                                id='admin.permission_policies.channel_management_access_confirm.body_effect'
                                defaultMessage='Anyone who does not meet the conditions will no longer be able to change the settings, bookmarks, members or access rules of channels covered by this policy. System admins are not affected.'
                            />
                        </p>
                    </>
                )}
                <p>
                    <FormattedMessage
                        id='admin.permission_policies.channel_read_access_confirm.body_simulate'
                        defaultMessage='Run Simulate rules first if you have not confirmed who this affects.'
                    />
                </p>
            </div>
        </GenericModal>
    );
}
