// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {ViewGridPlusOutlineIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

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
            <IconButton
                className='app_bar__marketplace_button'
                style='inverted'
                size='small'
                padding='compact'
                icon={<Icon glyph={<ViewGridPlusOutlineIcon/>}/>}
                aria-label={label}
                onClick={handleOpenMarketplace}
            />
        </WithTooltip>
    );
};

export default AppBarMarketplace;
