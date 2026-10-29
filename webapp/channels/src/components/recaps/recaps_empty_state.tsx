// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';

import AICopilotIntroSvg from './ai_copilot_intro_svg';

type Props = {
    onCreateClick: () => void;
    disabled?: boolean;
};

const RecapsEmptyState = ({onCreateClick, disabled}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <div className='recaps-placeholder'>
            <AICopilotIntroSvg/>
            <h2 className='recaps-placeholder-title'>
                {formatMessage({id: 'recaps.placeholder.title', defaultMessage: 'Set up your recap'})}
            </h2>
            <p className='recaps-placeholder-description'>
                {formatMessage({id: 'recaps.placeholder.description', defaultMessage: 'Recaps help you get caught up quickly on discussions that are most important to you with a summarized report.'})}
            </p>
            <Button
                emphasis='primary'
                onClick={onCreateClick}
                disabled={disabled}
                title={disabled ? formatMessage({id: 'recaps.addRecap.disabled', defaultMessage: 'Agents Bridge is not enabled'}) : undefined}
            >
                {formatMessage({id: 'recaps.placeholder.createRecap', defaultMessage: 'Create a recap'})}
            </Button>
        </div>
    );
};

export default RecapsEmptyState;
