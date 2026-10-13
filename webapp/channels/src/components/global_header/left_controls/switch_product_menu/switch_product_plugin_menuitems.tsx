// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallowEqual, useSelector} from 'react-redux';

import glyphMap from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

import * as Menu from 'components/menu';

import type {GlobalState} from 'types/store';
import type {ProductSwitcherMenuItemRegistration} from 'types/store/plugins';

export default function ProductSwitcherPluginMenuItems() {
    const visibleItems = useSelector((state: GlobalState) => {
        return (state.plugins.components.ProductSwitcherMenuItem ?? []).filter((item) => {
            if (item.isHidden === undefined) {
                return true;
            }

            try {
                return !item.isHidden(state);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error(`ProductSwitcherMenuItem ${item.pluginId}:${item.id} isHidden threw`, e);

                // Fail closed: hide the item if its predicate throws.
                return false;
            }
        });
    }, shallowEqual);

    if (visibleItems.length === 0) {
        return <></>;
    }

    return (
        <>
            <Menu.Separator/>
            {visibleItems.map((item) => (
                <ProductSwitcherPluginMenuItem
                    key={item.id}
                    item={item}
                />
            ))}
        </>
    );
}

interface Props {
    item: ProductSwitcherMenuItemRegistration;
}

function ProductSwitcherPluginMenuItem(props: Props) {
    const {item} = props;

    const Icon = typeof item.icon === 'string' ? glyphMap[item.icon as IconGlyphTypes] : null;

    function handleClick() {
        try {
            item.action();
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(`ProductSwitcherMenuItem ${item.pluginId}:${item.id} action threw`, e);
        }
    }

    return (
        <Menu.Item
            id={`product-switcher-menu-item-${item.id}`}
            leadingElement={Icon ? (
                <Icon
                    size={20}
                    aria-hidden='true'
                />
            ) : item.icon}
            labels={<span>{item.text}</span>}
            onClick={handleClick}
        />
    );
}
