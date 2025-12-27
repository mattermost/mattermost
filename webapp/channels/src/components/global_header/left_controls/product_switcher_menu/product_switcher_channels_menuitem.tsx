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
                    className='globalHeader-leftControls-productSwitcherMenu-productCheckmark'
                    aria-hidden='true'
                />
            )}
            onClick={handleClick}
            {...firstMenuItemProps}
        />
    );
}
