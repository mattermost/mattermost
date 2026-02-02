// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {isValidElement} from 'react';

import BlockableLink from 'components/admin_console/blockable_link';

import {createSafeId} from 'utils/utils';

type Props = {
    name: string;
    title: string | JSX.Element;
    action?: JSX.Element;
    children?: JSX.Element | JSX.Element[];
    definitionKey?: string;
    type?: string;
    parentLink?: string;
    subsection?: boolean;
    tag?: string | JSX.Element;
    restrictedIndicator?: string | JSX.Element;
    icon?: JSX.Element;
}

const AdminSidebarSection = ({name, title, action, children = [], definitionKey, type, parentLink = '', subsection = false, tag, restrictedIndicator, icon}: Props) => {
    const getLink = () => parentLink + '/' + name;

    const link = getLink();

    let clonedChildren = null;
    if (children) {
        clonedChildren = (
            <ul className='nav nav__sub-menu subsections'>
                {
                    React.Children.map(children, (child) => {
                        if (child === null) {
                            return null;
                        }

                        return React.cloneElement(child, {
                            parentLink: link,
                            subsection: true,
                        });
                    })
                }
            </ul>
        );
    }

    const className = classNames('sidebar-section', {'sidebar-subsection': subsection});
    const tagDiv = tag ? (
        <span className={`${className}-tag`}>
            {tag}
        </span>
    ) : null;
    const indicatorElem = restrictedIndicator && (
        <span className={`${className}-indicator`}>
            {restrictedIndicator}
        </span>
    );
    const sidebarItemSafeId = createSafeId(name);
    // Only render icon if it's a valid React element (prevents React error #130 from plugins with malformed icons)
    const iconElem = icon && isValidElement(icon) && (
        <span className={`${className}-icon`}>
            {icon}
        </span>
    );
    let sidebarItem = (
        <BlockableLink
            id={sidebarItemSafeId}
            className={`${className}-title`}
            activeClassName={`${className}-title ${className}-title--active`}
            to={link}
        >
            {iconElem}
            <span className={`${className}-title__text`}>
                {title}{tagDiv}
            </span>
            {indicatorElem}
            {action}
        </BlockableLink>
    );

    if (type === 'text') {
        sidebarItem = (
            <div className={`${className}-title`}>
                <span className={`${className}-title__text`}>
                    {title}
                </span>
                {action}
            </div>
        );
    }

    return (
        <li
            className={className}
            data-testid={definitionKey}
        >
            {sidebarItem}
            {clonedChildren}
        </li>
    );
};

export default AdminSidebarSection;
