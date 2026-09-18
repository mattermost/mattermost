// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {CancelIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

const Container = styled.div`
    display: flex;
    align-items: center;
    padding: 8px 24px;
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.75);

    & + .AdvancedTextEditor {
        padding-top: 0;
    }
`;

const Icon = styled(CancelIcon)`
    margin-right: 4px;
    flex-shrink: 0;
`;

type Props = {
    displayName: string;
    autoReplyMessage?: string;
};

const OutOfOfficeWarning = ({displayName, autoReplyMessage}: Props) => {
    const banner = (
        <Container
            className='OutOfOfficeWarning'
            data-testid='outOfOfficeWarning'
            tabIndex={autoReplyMessage ? 0 : undefined}
        >
            <Icon
                size={14}
                aria-hidden={true}
            />
            <FormattedMessage
                id='advanced_create_post.outOfOfficeWarning'
                defaultMessage='{displayName} is Out of Office.'
                values={{displayName}}
            />
        </Container>
    );

    if (!autoReplyMessage) {
        return banner;
    }

    return (
        <WithTooltip title={autoReplyMessage}>
            {banner}
        </WithTooltip>
    );
};

export default OutOfOfficeWarning;
