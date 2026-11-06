// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {CheckIcon, ProductBoardsIcon} from '@mattermost/compass-icons/components';

import {setProductRailSection} from 'actions/views/product_rail';

import * as Menu from 'components/menu';
import useProductRailSectionPaths from 'components/product_rail/use_product_rail_section_paths';

interface Props {
    isActive: boolean;
}

/**
 * Boards, as the product rail lists it, for where the rail isn't shown: it narrows the channel
 * sidebar to boards and opens the last board viewed, or the first.
 */
export default function ProductSwitcherBoardsMenuItem({isActive}: Props) {
    const dispatch = useDispatch();
    const history = useHistory();
    const {boardsPath} = useProductRailSectionPaths();

    function handleClick() {
        dispatch(setProductRailSection('boards'));
        if (boardsPath) {
            history.push(boardsPath);
        }
    }

    return (
        <Menu.Item
            id='product-menu-item-boards'
            className='globalHeader-leftControls-productSwitcherMenu-productMenuItem'
            leadingElement={(
                <ProductBoardsIcon
                    size={24}
                    aria-hidden='true'
                />
            )}
            labels={(
                <span>
                    <FormattedMessage
                        id='globalHeader.productSwitcherMenu.boardsMenuItem.label'
                        defaultMessage='Boards'
                        description='Product menu item, shown where the product rail is not, that narrows the channel sidebar to boards.'
                    />
                </span>
            )}
            trailingElements={isActive && (
                <CheckIcon
                    size={18}
                    aria-hidden='true'
                />
            )}
            onClick={handleClick}
        />
    );
}
