// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {EmptyState} from '@mattermost/compass-ui/components/empty-state';
import AICopilotIntroIllustration from '@mattermost/compass-ui/illustrations/ai-copilot-intro';

type Props = {
    onCreateClick: () => void;
    disabled?: boolean;

    // Overrides the default heading, e.g. for the Scheduled tab.
    title?: string;
    className?: string;
};

const RecapsEmptyState = ({onCreateClick, disabled, title, className}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <EmptyState
            className={className}
            illustration={{
                'aria-label': '',
                children: <AICopilotIntroIllustration/>,
            }}
            title={title ?? formatMessage({id: 'recaps.placeholder.title', defaultMessage: 'Set up your recap'})}
            description={formatMessage({id: 'recaps.placeholder.description', defaultMessage: 'Recaps help you get caught up quickly on discussions that are most important to you with a summarized report.'})}
            action={{
                emphasis: 'primary',
                onClick: onCreateClick,
                disabled,
                title: disabled ? formatMessage({id: 'recaps.addRecap.disabled', defaultMessage: 'Agents Bridge is not enabled'}) : undefined,
                children: formatMessage({id: 'recaps.placeholder.createRecap', defaultMessage: 'Create a recap'}),
            }}
        />
    );
};

export default RecapsEmptyState;
