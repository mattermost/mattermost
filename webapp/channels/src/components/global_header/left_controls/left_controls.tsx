// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isDesktopApp} from 'utils/user_agent';

import HistoryButtons from './history_buttons';
import ProductMenu from './product_menu';

import './left_controls.scss';

const LeftControls = (): JSX.Element => (
    <div className='globalHeader-leftControls'>
        <ProductMenu/>
        {isDesktopApp() && <HistoryButtons/>}
    </div>
);

export default LeftControls;
