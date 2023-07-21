// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ViewGridPlusOutlineIcon} from '@mattermost/compass-icons/components';
import React, {useCallback} from 'react';
import {Tooltip} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';

import OverlayTrigger from 'components/overlay_trigger';
import MarketplaceModal from 'components/plugin_marketplace/marketplace_modal';

import {Constants, ModalIdentifiers} from 'utils/constants';

const AppBarMarketplace = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const handleOpenMarketplace = useCallback(() => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.PLUGIN_MARKETPLACE,
                dialogType: MarketplaceModal,
                dialogProps: {openedFrom: 'app_bar'},
            }),
        );
    }, [dispatch]);

    const label = formatMessage({id: 'app_bar.marketplace', defaultMessage: 'App Marketplace'});

    return (
        <OverlayTrigger
            trigger={['hover', 'focus']}
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='left'
            overlay={(
                <Tooltip id='tooltip-app-bar-marketplace'>
                    <span>{label}</span>
                </Tooltip>
            )}
        >
            <button
                key='app_bar_marketplace'
                className='app_bar__marketplace_button'
                aria-label={label}
                onClick={handleOpenMarketplace}
            >
                <ViewGridPlusOutlineIcon size={18}/>
            </button>
        </OverlayTrigger>
    );
};

export default AppBarMarketplace;
