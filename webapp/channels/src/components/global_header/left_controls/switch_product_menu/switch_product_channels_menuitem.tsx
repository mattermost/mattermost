// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useHistory} from 'react-router-dom';

import {CheckIcon, ProductChannelsIcon} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';

interface Props extends Menu.FirstMenuItemProps {
    isChannelsProductActive: boolean;
}

export default function ProductChannelsMenuItem({isChannelsProductActive, ...firstMenuItemProps}: Props) {
    const history = useHistory();

    function handleClick() {
        history.push('/');
    }

    return (
        <Menu.Item
            className='globalHeader-leftControls-productSwitcherMenu-channelsMenuItem'
            leadingElement={(
                <ProductChannelsIcon
                    size={20}
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
