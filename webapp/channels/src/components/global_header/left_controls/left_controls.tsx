// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';

import {isDesktopApp} from '@mattermost/shared/utils/user_agent';
import type {ProductIdentifier} from '@mattermost/types/products';

import HistoryButtons from './history_buttons';
import ProductBranding from './product_branding';
import ProductSwitcherMenu from './switch_product_menu';

import './left_controls.scss';

type Props = {
    productId: ProductIdentifier;
};

const LeftControls = (props: Props): JSX.Element => (
    <div className='globalHeader-leftControls'>
        <ProductSwitcherMenu productId={props.productId}/>
        <ProductBranding/>
        {isDesktopApp() && <HistoryButtons/>}
    </div>
);

export default LeftControls;
