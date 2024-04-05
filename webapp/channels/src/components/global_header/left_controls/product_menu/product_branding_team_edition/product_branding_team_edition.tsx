// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import Heading from '@mattermost/compass-components/components/heading'; // eslint-disable-line no-restricted-imports
import {MattermostIcon} from '@mattermost/compass-icons/components';

const ProductBrandingTeamEditionContainer = styled.div`
    display: flex;
    align-items: center;

    > * + * {
        margin-left: 8px;
    }
`;

const Badge = styled.div`
    color: var(--sidebar-text-72, rgba(255, 255, 255, 0.72));
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.2px;
    display: flex;
    padding: 2px var(--spacing-xxxxs, 4px) 2px var(--spacing-xxxs, 6px);
    justify-content: center;
    align-items: center;
    border-radius: 4px;
    background: var(--sidebar-text-8, rgba(255, 255, 255, 0.08));
`;

const ProductBrandingTeamEdition = (): JSX.Element => {
    return (
        <ProductBrandingTeamEditionContainer tabIndex={0}>
            <MattermostIcon size={24}/>
            <Heading
                element='h1'
                size={200}
                margin='none'
            >
                {'Mattermost'}
            </Heading>
            <Badge>FREE VERSION</Badge>
        </ProductBrandingTeamEditionContainer>
    );
};

export default ProductBrandingTeamEdition;
