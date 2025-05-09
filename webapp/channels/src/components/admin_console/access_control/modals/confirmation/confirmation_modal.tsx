// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import './confirmation_modal.scss';
import GenericModal from '@mattermost/components/src/generic_modal/generic_modal';

type Props = {
    onExited: () => void;
    onConfirm: (apply: boolean) => void;
    channelsAffected: number;
}

export default function PolicyConfirmationModal({onExited, onConfirm, channelsAffected}: Props) {
    const {formatMessage} = useIntl();
    const [enforceImmediately, setEnforceImmediately] = useState(true);

    return (
        <GenericModal
            className={'PolicyConfirmationModal'}
            show={true}
            onExited={onExited}
            onHide={onExited}
            modalHeaderText={
                <div className='modal-header-custom'>
                    <div className='modal-header-top'>
                        <div className='modal-header-text'>
                            <FormattedMessage
                                id='admin.access_control.policy.save_policy_confirmation_title'
                                defaultMessage='Save access control policy '
                            />
                        </div>
                        <div className='close-icon-container'>
                            <i
                                className='icon icon-close'
                                onClick={onExited}
                                aria-label='Close'
                                role='button'
                                tabIndex={0}
                            />
                        </div>
                    </div>
                    <div className='modal-header-subheader'>
                        <FormattedMessage
                            id='admin.access_control.policy.save_policy_confirmation_subheader'
                            defaultMessage='{count} channels will be affected.'
                            values={{count: channelsAffected}}
                        />
                    </div>
                </div>
            }
            showHeader={false}
            footerContent={
                <div className='modal-footer'>
                    <button
                        type='button'
                        className='btn-cancel'
                        onClick={onExited}
                    >
                        {formatMessage({id: 'admin.access_control.edit_policy.cancel', defaultMessage: 'Cancel'})}
                    </button>
                    <button
                        type='button'
                        className={enforceImmediately ? 'btn-apply' : 'btn-save'}
                        onClick={() => onConfirm(enforceImmediately)}
                    >
                        {enforceImmediately ?
                            formatMessage({id: 'admin.access_control.edit_policy.apply_policy', defaultMessage: 'Apply policy'}) :
                            formatMessage({id: 'admin.access_control.edit_policy.save_policy', defaultMessage: 'Save policy'})
                        }
                    </button>
                </div>
            }
        >
            <div className='body'>
                {formatMessage({
                    id: 'admin.access_control.policy.save_policy_confirmation_body',
                    defaultMessage: 'Applying this policy will allow users with the appropriate attribute values to be invited to the selected channels. Existing channel members will be removed from these channels if they are not assigned the values defined in this access policy.',
                })}
            </div>

            <div className='enforce-toggle'>
                <label className='enforce-checkbox-label'>
                    <input
                        type='checkbox'
                        checked={enforceImmediately}
                        onChange={(e) => setEnforceImmediately(e.target.checked)}
                    />
                    <span>{formatMessage({
                        id: 'admin.access_control.policy.enforce_immediately',
                        defaultMessage: 'Enforce policy immediately',
                    })}</span>
                </label>
            </div>

            <div className='confirmation'>
                {enforceImmediately ?
                    formatMessage({
                        id: 'admin.access_control.policy.channels_affected',
                        defaultMessage: 'Are you sure you want to save and apply the access control policy?',
                    }) :
                    formatMessage({
                        id: 'admin.access_control.policy.save_only',
                        defaultMessage: 'Are you sure you want to save this access control policy?',
                    })
                }
            </div>
        </GenericModal>
    );
}
