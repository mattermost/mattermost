// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {ViewGridPlusOutlineIcon} from '@mattermost/compass-icons/components';
import WithTooltip from '@mattermost/design-system/src/components/primitives/with_tooltip';

import {openModal} from 'actions/views/modals';

import MarketplaceModal from 'components/plugin_marketplace/marketplace_modal';

import {ModalIdentifiers} from 'utils/constants';

const AppBarMarketplace = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const handleOpenMarketplace = useCallback(() => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.PLUGIN_MARKETPLACE,
                dialogType: MarketplaceModal,
                dialogProps: {},
            }),
        );
    }, [dispatch]);

    const label = formatMessage({id: 'app_bar.marketplace', defaultMessage: 'App Marketplace'});

    return (
        <WithTooltip
            title={label}
            isVertical={false}
        >
            <button
                key='app_bar_marketplace'
                className='app_bar__marketplace_button'
                aria-label={label}
                onClick={handleOpenMarketplace}
            >
                <ViewGridPlusOutlineIcon size={18}/>
            </button>
        </WithTooltip>
    );
};

export default AppBarMarketplace;
