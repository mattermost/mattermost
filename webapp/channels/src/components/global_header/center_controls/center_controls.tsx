// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ProductIdentifier} from '@mattermost/types/products';

import Pluggable from 'plugins/pluggable';
import {isChannels} from 'utils/products';

import GlobalSearchNav from './global_search_nav/global_search_nav';
import UserGuideDropdown from './user_guide_dropdown';

import './center_control.scss';

export type Props = {
    productId?: ProductIdentifier;
}

const CenterControls = ({productId = null}: Props): JSX.Element => {
    return (
        <div className='globalHeader-centerControls'>
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
        </div>
    );
};

export default CenterControls;
