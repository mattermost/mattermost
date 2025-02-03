// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

const Container = styled.div`
    padding: 8px 24px;
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.75);

    & + .AdvancedTextEditor {
        padding-top: 0;
    }
`;

const Icon = styled.i`
    color: #d24b4e;
    font-size: 14px;
    margin-right: 2px;
`;

type Props = {
    displayName: string;
}

const DoNotDisturbWarning = ({displayName}: Props) => {
    return (
        <Container className='DoNotDisturbWarning'>
            <Icon className='icon-minus-circle'/>
            <FormattedMessage
                id='advanced_create_post.doNotDisturbWarning'
                defaultMessage='{displayName} is set to <b>Do Not Disturb</b>'
                values={{displayName, b: (chunks: React.ReactNode) => <b>{chunks}</b>}}
            />
        </Container>
    );
};

export default DoNotDisturbWarning;
