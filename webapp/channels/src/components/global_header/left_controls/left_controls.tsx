// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isDesktopApp} from 'utils/user_agent';

import HistoryButtons from './history_buttons';
import ProductBranding from './product_branding';
import ProductMenu from './product_menu';

import './left_controls.scss';

const LeftControls = () => (
    <div className='globalHeader-leftControlsContainer'>
        <ProductMenu/>
        <ProductBranding/>
        {true && <HistoryButtons/>}
    </div>
);

export default LeftControls;
