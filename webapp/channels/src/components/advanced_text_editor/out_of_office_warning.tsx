// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {CancelIcon} from '@mattermost/compass-icons/components';

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
};

const OutOfOfficeWarning = ({displayName}: Props) => {
    return (
        <Container
            className='OutOfOfficeWarning'
            data-testid='outOfOfficeWarning'
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
};

export default OutOfOfficeWarning;
