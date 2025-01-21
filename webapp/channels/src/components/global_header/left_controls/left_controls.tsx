// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getIsMobileView} from 'selectors/views/browser';

import {isDesktopApp} from 'utils/user_agent';

import HistoryButtons from './history_buttons';
import ProductBranding from './product_branding';
import ProductMenu from './product_menu';

import './left_controls.scss';

export default function LeftControls() {
    const isMobileView = useSelector(getIsMobileView);

    if (isMobileView) {
        return null;
    }

    return (
        <div className='globalHeader-left-controls-container'>
            <ProductMenu/>
            <ProductBranding/>
            {isDesktopApp() && <HistoryButtons/>}
        </div>
    );
}
