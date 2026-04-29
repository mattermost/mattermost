// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import './team_policy_confirmation_modal.scss';

type Props = {
    channelsAffected: number;
    publicChannelsAffected?: number;
    privateChannelsAffected?: number;
    onExited: () => void;
    onConfirm: () => void;
    saving?: boolean;
}

export default function TeamPolicyConfirmationModal({channelsAffected, publicChannelsAffected = 0, privateChannelsAffected = 0, onExited, onConfirm, saving}: Props) {
    const {formatMessage} = useIntl();

    const hasMix = publicChannelsAffected > 0 && privateChannelsAffected > 0;
    const hasOnlyPublic = publicChannelsAffected > 0 && privateChannelsAffected === 0;

    let body: React.ReactNode;
    if (hasMix) {
        body = (
            <FormattedMessage
                id='team_settings.policy_editor.confirmation.body_mixed'
                defaultMessage='This policy is applied to <b>{count} assigned {count, plural, one {channel} other {channels}}</b> of mixed types. For <b>{privateCount, plural, one {# private channel} other {# private channels}}</b>, matching users will be granted access and non-matching members will be removed. For <b>{publicCount, plural, one {# public channel} other {# public channels}}</b>, the policy is advisory: matching users will be recommended to join the channel and auto-added when enabled, but no existing members will ever be removed.'
                values={{
                    count: channelsAffected,
                    publicCount: publicChannelsAffected,
                    privateCount: privateChannelsAffected,
                    b: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                }}
            />
        );
    } else if (hasOnlyPublic) {
        body = (
            <FormattedMessage
                id='team_settings.policy_editor.confirmation.body_public'
                defaultMessage='This policy will be applied to <b>{count} assigned {count, plural, one {public channel} other {public channels}}</b>. Matching users will see {count, plural, one {this channel} other {these channels}} as recommendations, and will be auto-added when auto-add is enabled. No existing members will be removed.'
                values={{
                    count: channelsAffected,
                    b: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                }}
            />
        );
    } else {
        body = (
            <FormattedMessage
                id='team_settings.policy_editor.confirmation.body'
                defaultMessage='This policy will grant users with matching attribute values access to <b>{count} assigned {count, plural, one {channel} other {channels}}</b> and remove users without these attribute values.'
                values={{
                    count: channelsAffected,
                    b: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                }}
            />
        );
    }

    return (
        <GenericModal
            className='TeamPolicyConfirmationModal'
            show={true}
            isStacked={true}
            onExited={onExited}
            onHide={onExited}
            compassDesign={true}
            modalHeaderText={
                <FormattedMessage
                    id='team_settings.policy_editor.confirmation.title'
                    defaultMessage='Save and apply policy'
                />
            }
            footerContent={
                <div className='TeamPolicyConfirmationModal__footer'>
                    <button
                        type='button'
                        className='btn btn-tertiary'
                        onClick={onExited}
                    >
                        {formatMessage({id: 'team_settings.policy_editor.confirmation.cancel', defaultMessage: 'Cancel'})}
                    </button>
                    <button
                        type='button'
                        className='btn btn-danger'
                        onClick={onConfirm}
                        disabled={saving}
                    >
                        {formatMessage({id: 'team_settings.policy_editor.confirmation.apply', defaultMessage: 'Apply policy'})}
                    </button>
                </div>
            }
        >
            <div className='TeamPolicyConfirmationModal__body'>
                <p>{body}</p>
                <p>
                    <FormattedMessage
                        id='team_settings.policy_editor.confirmation.question'
                        defaultMessage='Are you sure you want to save and apply the membership policy?'
                    />
                </p>
            </div>
        </GenericModal>
    );
}
