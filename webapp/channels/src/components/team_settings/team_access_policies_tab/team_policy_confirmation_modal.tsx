// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import {Button} from '@mattermost/shared/components/button';

import './team_policy_confirmation_modal.scss';

type Props = {
    channelsAffected: number;
    onExited: () => void;
    onConfirm: () => void;
    saving?: boolean;
}

export default function TeamPolicyConfirmationModal({channelsAffected, onExited, onConfirm, saving}: Props) {
    const {formatMessage} = useIntl();

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
                    <Button
                        type='button'
                        emphasis='tertiary'
                        onClick={onExited}
                    >
                        {formatMessage({id: 'team_settings.policy_editor.confirmation.cancel', defaultMessage: 'Cancel'})}
                    </Button>
                    <Button
                        type='button'
                        variant='destructive'
                        onClick={onConfirm}
                        disabled={saving}
                    >
                        {formatMessage({id: 'team_settings.policy_editor.confirmation.apply', defaultMessage: 'Apply policy'})}
                    </Button>
                </div>
            }
        >
            <div className='TeamPolicyConfirmationModal__body'>
                <p>
                    <FormattedMessage
                        id='team_settings.policy_editor.confirmation.body'
                        defaultMessage='This policy will grant users with matching attribute values access to <b>{count} assigned {count, plural, one {channel} other {channels}}</b> and remove users without these attribute values.'
                        values={{
                            count: channelsAffected,
                            b: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                        }}
                    />
                </p>
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
