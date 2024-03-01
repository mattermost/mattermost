// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useSelector} from 'react-redux';
import {NavLink, useRouteMatch} from 'react-router-dom';

import {getLeftHandSidebarItemPluginComponents} from 'selectors/plugins';

function PluggableSidebarList() {
    const pluginItems = useSelector(getLeftHandSidebarItemPluginComponents);

    const {url} = useRouteMatch();

    return (
        <>
            {pluginItems.map((item) => (
                <ul
                    key={`lhs-plugin-${item.id}`}
                    className='NavGroupContent nav nav-pills__container'
                >
                    <li
                        className='SidebarChannel'
                        tabIndex={-1}
                        id={`lhs-plugin-item-${item.id}`}
                    >
                        <NavLink
                            to={`${url}/${item.route}`}
                            id={`sidebarItem_plugin_${item.id}`}
                            activeClassName='active'
                            draggable='false'
                            className='SidebarLink sidebar-item'
                            tabIndex={0}
                        >
                            {item.text}
                        </NavLink>
                    </li>
                </ul>
            ))}
        </>
    );
}

export default memo(PluggableSidebarList);
