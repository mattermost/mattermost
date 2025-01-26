// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ProductIdentifier} from '@mattermost/types/products';

import Pluggable from 'plugins/pluggable';
import {isChannels} from 'utils/products';

import GlobalSearchNav from './global_search_nav/global_search_nav';
import UserGuideDropdown from './user_guide_dropdown';

import './center_controls.scss';

export type Props = {
    productId?: ProductIdentifier;
}

export default function CenterControls({productId = null}: Props) {
    return (
        <div className='globalHeader-center-controls-container'>
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
}
