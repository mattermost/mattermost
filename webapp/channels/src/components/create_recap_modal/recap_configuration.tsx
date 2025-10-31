// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {ProductChannelsIcon, LightningBoltOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import WithTooltip from 'components/with_tooltip';

type Props = {
    recapName: string;
    setRecapName: (name: string) => void;
    recapType: 'selected' | 'all_unreads' | null;
    setRecapType: (type: 'selected' | 'all_unreads') => void;
    unreadChannels: Channel[];
};

const RecapConfiguration = ({recapName, setRecapName, recapType, setRecapType, unreadChannels}: Props) => {
    const {formatMessage} = useIntl();
    const hasUnreadChannels = unreadChannels.length > 0;

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
                    {formatMessage({id: 'recaps.modal.allUnreads', defaultMessage: 'Recap all my unreads'})}
                </div>
                <div className='recap-type-card-description'>
                    {formatMessage({id: 'recaps.modal.allUnreadsDesc', defaultMessage: 'Copilot will create a recap of all unreads across your channels.'})}
                </div>
            </div>
            {recapType === 'all_unreads' && <i className='icon icon-check-circle selected-icon'/>}
        </button>
    );

    return (
        <div className='step-one'>
            <div className='form-group name-input-group'>
                <label className='form-label'>
                    {formatMessage({id: 'recaps.modal.nameLabel', defaultMessage: 'Give your recap a name'})}
                </label>
                <div className='input-container'>
                    <input
                        type='text'
                        className='form-control'
                        placeholder={formatMessage({id: 'recaps.modal.namePlaceholder', defaultMessage: 'Give your recap a name'})}
                        value={recapName}
                        onChange={(e) => setRecapName(e.target.value)}
                        maxLength={100}
                    />
                </div>
            </div>

            <div className='form-group type-selection-group'>
                <label className='form-label'>
                    {formatMessage({id: 'recaps.modal.typeLabel', defaultMessage: 'What type of recap would you like?'})}
                </label>
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
                                {formatMessage({id: 'recaps.modal.selectedChannels', defaultMessage: 'Recap selected channels'})}
                            </div>
                            <div className='recap-type-card-description'>
                                {formatMessage({id: 'recaps.modal.selectedChannelsDesc', defaultMessage: 'Choose the channels you would like included in your recap'})}
                            </div>
                        </div>
                        {recapType === 'selected' && <i className='icon icon-check-circle selected-icon'/>}
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

