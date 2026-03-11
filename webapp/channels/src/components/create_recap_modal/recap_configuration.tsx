// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, FormattedMessage} from 'react-intl';

import {ProductChannelsIcon, LightningBoltOutlineIcon, CheckCircleIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import Toggle from 'components/toggle';
import WithTooltip from 'components/with_tooltip';

const RECAP_NAME_MAX_LENGTH = 100;

type Props = {
    recapName: string;
    setRecapName: (name: string) => void;
    recapType: 'selected' | 'all_unreads' | null;
    setRecapType: (type: 'selected' | 'all_unreads') => void;
    unreadChannels: Channel[];
    runOnce: boolean;
    setRunOnce: (value: boolean) => void;
    isEditMode?: boolean;
};

const RecapConfiguration = ({
    recapName,
    setRecapName,
    recapType,
    setRecapType,
    unreadChannels,
    runOnce,
    setRunOnce,
    isEditMode,
}: Props) => {
    const {formatMessage} = useIntl();
    const hasUnreadChannels = unreadChannels.length > 0;

    const runOnceDisabled = recapType === 'all_unreads' && !hasUnreadChannels;

    const handleAllUnreadsClick = () => {
        setRecapType('all_unreads');
        if (!hasUnreadChannels && runOnce) {
            setRunOnce(false);
        }
    };

    const runOnceToggle = (
        <div className='run-once-toggle'>
            <Toggle
                id='run-once-toggle'
                toggled={runOnce}
                onToggle={() => setRunOnce(!runOnce)}
                size='btn-sm'
                toggleClassName='btn-toggle-primary'
                disabled={runOnceDisabled}
            />
            <label
                htmlFor='run-once-toggle'
                className='run-once-label'
            >
                <FormattedMessage
                    id='recaps.modal.runOnce'
                    defaultMessage='Run once'
                />
            </label>
        </div>
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
                <div className='input-container'>
                    <input
                        id='recap-name-input'
                        type='text'
                        className='form-control'
                        placeholder={formatMessage({id: 'recaps.modal.namePlaceholder', defaultMessage: 'Give your recap a name'})}
                        value={recapName}
                        onChange={(e) => setRecapName(e.target.value)}
                        maxLength={RECAP_NAME_MAX_LENGTH}
                    />
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

                    <button
                        type='button'
                        className={`recap-type-card ${recapType === 'all_unreads' ? 'selected' : ''}`}
                        onClick={handleAllUnreadsClick}
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
                </div>
            </div>

            {/* Run once toggle - hidden in edit mode */}
            {!isEditMode && (
                <div className='form-group run-once-group'>
                    {runOnceDisabled ? (
                        <WithTooltip
                            title={formatMessage({id: 'recaps.modal.runOnceDisabledTitle', defaultMessage: 'No unread messages'})}
                            hint={formatMessage({id: 'recaps.modal.runOnceDisabledHint', defaultMessage: 'You have no unread messages to recap right now. Schedule this recap to run in the future instead.'})}
                        >
                            {runOnceToggle}
                        </WithTooltip>
                    ) : runOnceToggle}
                    <div className='run-once-description'>
                        <FormattedMessage
                            id='recaps.modal.runOnceDescription'
                            defaultMessage='Create an immediate recap without scheduling'
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecapConfiguration;

