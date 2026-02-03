// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import type {ChangeEvent} from 'react';
import {useIntl} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import Input from 'components/widgets/inputs/input/input';
import BaseSettingItem, {type BaseSettingItemProps} from 'components/widgets/modals/components/base_setting_item';

import Constants from 'utils/constants';

type Props = {
    handleDescriptionChanges: (name: string) => void;
    description: Team['description'];
    clientError?: BaseSettingItemProps['error'];
};

const TeamDescriptionSection = ({handleDescriptionChanges, clientError, description}: Props) => {
    const {formatMessage} = useIntl();

    const updateDescription = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleDescriptionChanges(e.target.value);
    }, [handleDescriptionChanges]);

    const descriptionSectionInput = (
        <Input
            id='teamDescription'
            data-testid='teamDescriptionInput'
            containerClassName='description-section-input'
            type='textarea'
            maxLength={Constants.MAX_TEAMDESCRIPTION_LENGTH}
            onChange={updateDescription}
            value={description}
            label={formatMessage({id: 'general_tab.teamDescription', defaultMessage: 'Description'})}
        />
    );

    return (
        <BaseSettingItem
            description={formatMessage({
                id: 'general_tab.teamDescriptionInfo',
                defaultMessage: 'Team description provides additional information to help users select the right team. Maximum of 50 characters.',
            })}
            content={descriptionSectionInput}
            className='description-setting-item'
            error={clientError}
        />
    );
};

export default TeamDescriptionSection;
