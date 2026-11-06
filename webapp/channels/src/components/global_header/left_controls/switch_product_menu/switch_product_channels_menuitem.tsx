// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {CheckIcon, ProductChannelsIcon} from '@mattermost/compass-icons/components';

import {setProductRailSection} from 'actions/views/product_rail';
import {getProductRailSection} from 'selectors/views/product_rail';

import * as Menu from 'components/menu';
import useProductRailSectionPaths from 'components/product_rail/use_product_rail_section_paths';

interface Props extends Menu.FirstMenuItemProps {
    isChannelsProductActive: boolean;
}

export default function ProductChannelsMenuItem({isChannelsProductActive, ...firstMenuItemProps}: Props) {
    const history = useHistory();
    const dispatch = useDispatch();
    const section = useSelector(getProductRailSection);
    const {channelsPath} = useProductRailSectionPaths();

    function handleClick() {
        // While boards are split off, the last channel viewed may be a board, which '/' would
        // reopen, so Channels returns to where the user was under it.
        if (section) {
            dispatch(setProductRailSection('channels'));
            history.push(channelsPath ?? '/');
            return;
        }
        history.push('/');
    }

    return (
        <Menu.Item
            className='globalHeader-leftControls-productSwitcherMenu-productMenuItem'
            leadingElement={(
                <ProductChannelsIcon
                    size={24}
                    aria-hidden='true'
                />
            )}
            labels={(
                <span>
                    {'Channels'}
                </span>
            )}
            trailingElements={isChannelsProductActive && (
                <CheckIcon
                    size={18}
                    aria-hidden='true'
                />
            )}
            onClick={handleClick}
            {...firstMenuItemProps}
        />
    );
}
