// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import './confirmation_modal.scss';

type Props = {
    active: boolean;
    onExited: () => void;
    onConfirm: (apply: boolean) => void;
    channelsAffected: number;
    publicChannelsAffected?: number;
    privateChannelsAffected?: number;
}

export default function PolicyConfirmationModal({active, onExited, onConfirm, channelsAffected, publicChannelsAffected = 0, privateChannelsAffected = 0}: Props) {
    const {formatMessage} = useIntl();
    const [enforceImmediately, setEnforceImmediately] = useState(true);

    const hasMix = publicChannelsAffected > 0 && privateChannelsAffected > 0;
    const hasOnlyPublic = publicChannelsAffected > 0 && privateChannelsAffected === 0;

    let bodyText: string;
    if (hasMix) {
        bodyText = active ? formatMessage({
            id: 'admin.access_control.policy.save_policy_confirmation_body.mixed',
            defaultMessage: 'This policy is applied to channels of mixed types. For private channels, matching users will be granted access and non-matching members will be removed. For public channels, matching users will see these channels as recommendations and will be auto-added when auto-add is enabled; no existing members will be removed.',
        }) : formatMessage({
            id: 'admin.access_control.policy.save_policy_confirmation_body.mixed_inactive',
            defaultMessage: 'This policy is applied to channels of mixed types. For private channels, only matching users can be added and non-matching existing members will be removed. For public channels, the policy acts as a recommendation only; no existing members will be removed.',
        });
    } else if (hasOnlyPublic) {
        bodyText = active ? formatMessage({
            id: 'admin.access_control.policy.save_policy_confirmation_body.public',
            defaultMessage: 'Matching users will see these public channels as recommendations and, when auto-add is enabled, will be added automatically. Anyone can still join these channels; no existing members will be removed.',
        }) : formatMessage({
            id: 'admin.access_control.policy.save_policy_confirmation_body.public_inactive',
            defaultMessage: 'Matching users will see these public channels as recommendations only; no existing members will be removed. Turn on Active (auto-add) to add matching users automatically.',
        });
    } else {
        bodyText = active ? formatMessage({
            id: 'admin.access_control.policy.save_policy_confirmation_body',
            defaultMessage: 'Applying this policy will allow users with the appropriate attribute values to be added to the selected channels. Existing channel members will be removed from these channels if they are not assigned the values defined in this membership policy.',
        }) : formatMessage({
            id: 'admin.access_control.policy.save_policy_confirmation_body.inactive',
            defaultMessage: 'Only users who match the attribute values configured below can be added to the selected channels. Existing channel members will be removed from these channels if they are not assigned the values defined in this membership policy.',
        });
    }

    return (
        <GenericModal
            className={'PolicyConfirmationModal'}
            show={true}
            onExited={onExited}
            onHide={onExited}
            compassDesign={true}
            modalHeaderText={
                <FormattedMessage
                    id='admin.access_control.policy.save_policy_confirmation_title'
                    defaultMessage='Save membership policy'
                />
            }
            modalSubheaderText={
                <FormattedMessage
                    id='admin.access_control.policy.save_policy_confirmation_subheader'
                    defaultMessage='{count} channels will be affected.'
                    values={{count: channelsAffected}}
                />
            }
            footerContent={
                <div>
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
                {bodyText}
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
                        defaultMessage: 'Are you sure you want to save and apply the membership policy?',
                    }) :
                    formatMessage({
                        id: 'admin.access_control.policy.save_only',
                        defaultMessage: 'Are you sure you want to save this membership policy?',
                    })
                }
            </div>
        </GenericModal>
    );
}
