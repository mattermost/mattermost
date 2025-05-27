// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {getIsMobileView} from 'selectors/views/browser';

import CompassThemeProvider from 'components/compass_theme_provider/compass_theme_provider';

import {useCurrentProductId} from 'utils/products';

import CenterControls from './center_controls/center_controls';
import {useIsLoggedIn} from './hooks';
import LeftControls from './left_controls/left_controls';
import RightControls from './right_controls/right_controls';

import './global_header.scss';

export default function GlobalHeader() {
    const isLoggedIn = useIsLoggedIn();
    const currentProductID = useCurrentProductId();

    const isMobileView = useSelector(getIsMobileView);

    const theme = useSelector(getTheme);

    if (!isLoggedIn) {
        return null;
    }

    if (isMobileView) {
        return null;
    }

    return (
        <CompassThemeProvider theme={theme}>
            <div
                id='global-header'
                className='globalHeader-container'
            >
                <LeftControls productId={currentProductID}/>
                <CenterControls productId={currentProductID}/>
                <RightControls productId={currentProductID}/>
            </div>
        </CompassThemeProvider>
    );
}
