// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {getIsMobileView} from 'selectors/views/browser';

import {useCurrentProductId} from 'utils/products';

import CenterControls from './center_controls/center_controls';
import LeftControls from './left_controls/left_controls';
import RightControls from './right_controls/right_controls';

import './global_header.scss';

const GlobalHeader = () => {
    const isLoggedIn = Boolean(useSelector(getCurrentUser));
    const currentProductID = useCurrentProductId();

    const isMobileView = useSelector(getIsMobileView);

    if (!isLoggedIn) {
        return null;
    }

    if (isMobileView) {
        return null;
    }

    return (
        <div
            id='global-header'
            className='globalHeader'
        >
            <LeftControls productId={currentProductID}/>
            <CenterControls productId={currentProductID}/>
            <RightControls productId={currentProductID}/>
        </div>
    );
};

export default GlobalHeader;
