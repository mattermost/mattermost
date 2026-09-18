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
    color: var(--error-text);
    margin-right: 4px;
    flex-shrink: 0;
`;

const Label = styled.span`
    display: inline-flex;
    align-items: center;
`;

type Props = {
    displayName: string;
    autoReplyMessage?: string;
};

const OutOfOfficeWarning = ({displayName, autoReplyMessage}: Props) => {
    const label = (
        <Label className='OutOfOfficeWarning__label'>
            <Icon
                size={14}
                aria-hidden={true}
            />
            <FormattedMessage
                id='advanced_create_post.outOfOfficeWarning'
                defaultMessage='{displayName} is Out of Office.'
                values={{displayName}}
            />
        </Label>
    );

    return (
        <Container
            className='OutOfOfficeWarning'
            data-testid='outOfOfficeWarning'
        >
            {autoReplyMessage ? (
                <WithTooltip title={autoReplyMessage}>
                    {label}
                </WithTooltip>
            ) : label}
        </Container>
    );
};

export default OutOfOfficeWarning;
