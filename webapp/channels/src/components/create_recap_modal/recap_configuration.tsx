// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';

import {ProductChannelsIcon, LightningBoltOutlineIcon, CheckCircleIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Channel} from '@mattermost/types/channels';

const RECAP_NAME_MAX_LENGTH = 100;

type Props = {
    recapName: string;
    setRecapName: (name: string) => void;
    recapType: 'selected' | 'all_unreads' | null;
    setRecapType: (type: 'selected' | 'all_unreads') => void;
    unreadChannels: Channel[];
};

const RecapConfiguration = ({recapName, setRecapName, recapType, setRecapType, unreadChannels}: Props) => {
    const {formatMessage} = useIntl();
    const [touched, setTouched] = useState(false);
    const hasUnreadChannels = unreadChannels.length > 0;

    const showError = touched && recapName.trim().length === 0;

    const handleBlur = useCallback(() => {
        setTouched(true);
    }, []);

    const allUnreadsButton = (
        <button
            type='button'
            className={`recap-type-card ${recapType === 'all_unreads' ? 'selected' : ''} ${hasUnreadChannels ? '' : 'disabled'}`}
            onClick={() => hasUnreadChannels && setRecapType('all_unreads')}
            disabled={!hasUnreadChannels}
        >
            <div className='recap-type-card-icon'>
                <LightningBoltOutlineIcon size={24}/>
            </div>
            <div className='recap-type-card-content'>
                <div className='recap-type-card-title'>
                    <FormattedMessage
                        id='recaps.modal.allUnreads'
                        defaultMessage='Recap all my unreads'
                    />
                </div>
                <div className='recap-type-card-description'>
                    <FormattedMessage
                        id='recaps.modal.allUnreadsDesc'
                        defaultMessage='Create a recap of all unread messages across your channels.'
                    />
                </div>
            </div>
            {recapType === 'all_unreads' && <CheckCircleIcon className='selected-icon'/>}
        </button>
    );

    return (
        <div className='step-one'>
            <div className='form-group name-input-group'>
                <label
                    className='form-label'
                    htmlFor='recap-name-input'
                >
                    <FormattedMessage
                        id='recaps.modal.nameLabel'
                        defaultMessage='Give your recap a name'
                    />
                </label>
                <div className={`input-container${showError ? ' has-error' : ''}`}>
                    <input
                        id='recap-name-input'
                        type='text'
                        autoFocus={true}
                        className={`form-control${showError ? ' input-error' : ''}`}
                        placeholder={formatMessage({id: 'recaps.modal.namePlaceholder', defaultMessage: 'Give your recap a name'})}
                        value={recapName}
                        onChange={(e) => setRecapName(e.target.value)}
                        onBlur={handleBlur}
                        maxLength={RECAP_NAME_MAX_LENGTH}
                        aria-invalid={showError}
                    />
                    {showError && (
                        <div className='input-error-message'>
                            <i className='icon icon-alert-circle-outline'/>
                            <FormattedMessage
                                id='recaps.modal.nameRequired'
                                defaultMessage='This field is required'
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className='form-group type-selection-group'>
                <div
                    className='form-label'
                    id='recap-type-label'
                >
                    <FormattedMessage
                        id='recaps.modal.typeLabel'
                        defaultMessage='What type of recap would you like?'
                    />
                </div>
                <div className='recap-type-options'>
                    <button
                        type='button'
                        className={`recap-type-card ${recapType === 'selected' ? 'selected' : ''}`}
                        onClick={() => setRecapType('selected')}
                    >
                        <div className='recap-type-card-icon'>
                            <ProductChannelsIcon size={24}/>
                        </div>
                        <div className='recap-type-card-content'>
                            <div className='recap-type-card-title'>
                                <FormattedMessage
                                    id='recaps.modal.selectedChannels'
                                    defaultMessage='Recap selected channels'
                                />
                            </div>
                            <div className='recap-type-card-description'>
                                <FormattedMessage
                                    id='recaps.modal.selectedChannelsDesc'
                                    defaultMessage='Choose the channels you would like included in your recap'
                                />
                            </div>
                        </div>
                        {recapType === 'selected' && <CheckCircleIcon className='selected-icon'/>}
                    </button>

                    {hasUnreadChannels ? allUnreadsButton : (
                        <WithTooltip
                            title={formatMessage({id: 'recaps.modal.noUnreadsAvailable', defaultMessage: 'No unread channels available'})}
                            hint={formatMessage({id: 'recaps.modal.noUnreadsAvailableHint', defaultMessage: 'You currently have no unread messages in any channels'})}
                        >
                            {allUnreadsButton}
                        </WithTooltip>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecapConfiguration;

