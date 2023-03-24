// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {ProductIdentifier} from '@mattermost/types/products';

import Pluggable from 'plugins/pluggable';

import {isChannels} from 'utils/products';

import GlobalSearchNav from './global_search_nav/global_search_nav';
import UserGuideDropdown from './user_guide_dropdown';

const CenterControlsContainer = styled.div`
    display: flex;
    align-items: center;
    height: 40px;
    justify-content: center;
    flex-grow: 1;
    flex-basis: 40%;

    > * + * {
        margin-left: 8px;
    }
`;

export type Props = {
    productId?: ProductIdentifier;
}

const CenterControls = ({productId = null}: Props): JSX.Element => {
    return (
        <CenterControlsContainer>
            {isChannels(productId) ? (
                <>
                    <GlobalSearchNav/>
                    <UserGuideDropdown/>
                </>
            ) : (
                <Pluggable
                    pluggableName={'Product'}
                    subComponentName={'headerCentreComponent'}
                    pluggableId={productId}
                />
            )}
        </CenterControlsContainer>
    );
};

export default CenterControls;
