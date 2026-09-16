// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import glyphMap, {CheckIcon, OpenInNewIcon} from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {ProductIdentifier} from '@mattermost/types/products';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {selectProducts} from 'selectors/products';

import * as Menu from 'components/menu';

import {getProductSwitcherLinkURL} from 'utils/products';

interface Props {
    currentProductID: ProductIdentifier;
}

export default function ProductSwitcherProductsMenuItems(props: Props) {
    const products = useSelector(selectProducts);
    const currentTeam = useSelector(getCurrentTeam);

    if (products.length === 0) {
        return <></>;
    }

    return (
        <>
            {products.map((product) => {
                const link = getProductSwitcherLinkURL(product, currentTeam?.name);
                if (link === null) {
                    return null;
                }

                return (
                    <ProductSwitcherProductMenuItem
                        key={product.id}
                        id={`product-menu-item-${product.pluginId || product.id}`}
                        icon={product.switcherIcon}
                        label={product.switcherText}
                        link={link}
                        isActive={product.id === props.currentProductID}
                    />
                );
            })}
        </>
    );
}

interface ProductSwitcherProductMenuItemProps {
    id: string;
    icon: IconGlyphTypes | React.ReactNode;
    label: React.ReactNode;
    link: string;
    isActive: boolean;
}

function ProductSwitcherProductMenuItem(props: ProductSwitcherProductMenuItemProps) {
    const {formatMessage} = useIntl();
    const history = useHistory();

    const Icon = typeof props.icon === 'string' ? glyphMap[props.icon as IconGlyphTypes] : null;

    const openInNewTabLabel = formatMessage({id: 'product_menu_item.open_in_new_tab', defaultMessage: 'Open in new tab'});

    function handleClick() {
        history.push(props.link);
    }

    function handleOpenInNewTabClick(event: React.MouseEvent<HTMLButtonElement>) {
        // Stop the click from also triggering the menu item's own navigation.
        event.preventDefault();
        event.stopPropagation();

        window.open(props.link, '_blank', 'noopener,noreferrer');
    }

    return (
        <Menu.Item
            id={props.id}
            className='globalHeader-leftControls-productSwitcherMenu-productMenuItem'
            leadingElement={Icon ? (
                <Icon
                    size={20}
                    aria-hidden='true'
                />
            ) : props.icon}
            labels={(
                <span>
                    {props.label}
                </span>
            )}
            trailingElements={props.isActive ? (
                <CheckIcon
                    size={18}
                    aria-hidden='true'
                />
            ) : (
                <WithTooltip title={openInNewTabLabel}>
                    <button
                        type='button'
                        className='globalHeader-leftControls-productSwitcherMenu-openInNewTabButton'
                        aria-label={openInNewTabLabel}
                        onClick={handleOpenInNewTabClick}
                    >
                        <OpenInNewIcon size={16}/>
                    </button>
                </WithTooltip>
            )}
            onClick={handleClick}
        />
    );
}
