// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {ProductChannelsIcon, LightningBoltOutlineIcon} from '@mattermost/compass-icons/components';

type Props = {
    recapName: string;
    setRecapName: (name: string) => void;
    recapType: 'selected' | 'all_unreads' | null;
    setRecapType: (type: 'selected' | 'all_unreads') => void;
};

const StepOne = ({recapName, setRecapName, recapType, setRecapType}: Props) => {
    const {formatMessage} = useIntl();

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
                        placeholder={formatMessage({id: 'recaps.modal.namePlaceholder', defaultMessage: 'Daily Design Digest'})}
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

                    <button
                        type='button'
                        className={`recap-type-card ${recapType === 'all_unreads' ? 'selected' : ''}`}
                        onClick={() => setRecapType('all_unreads')}
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
                </div>
            </div>
        </div>
    );
};

export default StepOne;

