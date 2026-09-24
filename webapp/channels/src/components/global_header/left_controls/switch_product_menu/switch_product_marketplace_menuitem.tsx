// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {ViewGridPlusOutlineIcon} from '@mattermost/compass-icons/components';

import {Permissions} from 'mattermost-redux/constants';
import {isMarketplaceEnabled} from 'mattermost-redux/selectors/entities/general';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import MarketplaceModal from 'components/plugin_marketplace/marketplace_modal';

import {ModalIdentifiers} from 'utils/constants';

interface Props {
    isChannelsProductActive: boolean;
    currentTeamId?: string;
}

export default function ProductSwitcherMarketplaceMenuItem(props: Props) {
    const dispatch = useDispatch();

    const isAppMarketplaceEnabled = useSelector(isMarketplaceEnabled);

    if (!props.isChannelsProductActive) {
        return null;
    }

    if (!isAppMarketplaceEnabled) {
        return null;
    }

    function handleClick() {
        dispatch(openModal({
            modalId: ModalIdentifiers.PLUGIN_MARKETPLACE,
            dialogType: MarketplaceModal,
        }));
    }

    return (
        <TeamPermissionGate
            teamId={props.currentTeamId}
            permissions={[Permissions.SYSCONSOLE_WRITE_PLUGINS]}
        >
            <Menu.Item
                leadingElement={<ViewGridPlusOutlineIcon size={18}/>}
                labels={
                    <FormattedMessage
                        id='globalHeader.productSwitcherMenu.marketplaceMenuItem.label'
                        defaultMessage='App Marketplace'
                    />
                }
                onClick={handleClick}
            />
        </TeamPermissionGate>
    );
}

