// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import type {ChangeEvent} from 'react';
import {defineMessages, useIntl} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import Input from 'components/widgets/inputs/input/input';
import BaseSettingItem, {type BaseSettingItemProps} from 'components/widgets/modals/components/base_setting_item';

import Constants from 'utils/constants';

const translations = defineMessages({
    TeamInfo: {
        id: 'general_tab.teamInfo',
        defaultMessage: 'Team info',
    },
    TeamNameInfo: {
        id: 'general_tab.teamNameInfo',
        defaultMessage: 'This name will appear on your sign-in screen and at the top of the left sidebar.',
    },
});

type Props = {
    handleNameChanges: (name: string) => void;
    name?: Team['display_name'];
    clientError: BaseSettingItemProps['error'];
};

const TeamNameSection = ({clientError, handleNameChanges, name}: Props) => {
    const {formatMessage} = useIntl();

    const updateName = useCallback((e: ChangeEvent<HTMLInputElement>) => handleNameChanges(e.target.value), [handleNameChanges]);

    const nameSectionInput = (
        <Input
            id='teamName'
            data-testid='teamNameInput'
            type='text'
            maxLength={Constants.MAX_TEAMNAME_LENGTH}
            onChange={updateName}
            value={name}
            label={formatMessage({id: 'general_tab.teamName', defaultMessage: 'Team Name'})}
        />
    );

    return (
        <BaseSettingItem
            title={translations.TeamInfo}
            description={translations.TeamNameInfo}
            content={nameSectionInput}
            error={clientError}
        />
    );
};

export default TeamNameSection;
