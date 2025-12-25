// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useHistory} from 'react-router-dom';

import {CheckIcon, ProductChannelsIcon} from '@mattermost/compass-icons/components';
import type {ProductIdentifier} from '@mattermost/types/products';

import * as Menu from 'components/menu';

import {isChannels} from 'utils/products';

interface Props extends Menu.FirstMenuItemProps {
    currentProductID: ProductIdentifier;
}

export default function ProductChannelsMenuItem({currentProductID, ...firstMenuItemProps}: Props) {
    const history = useHistory();

    const isChannelsProductActive = isChannels(currentProductID);

    function handleClick() {
        history.push('/');
    }

    return (
        <Menu.Item
            leadingElement={(
                <ProductChannelsIcon
                    className='globalHeader-leftControls-productSwitcherMenu-productIcons'
                    size={20}
                    aria-hidden='true'
                />
            )}
            labels={(
                <span className='globalHeader-leftControls-productSwitcherMenu-productLabels'>
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
