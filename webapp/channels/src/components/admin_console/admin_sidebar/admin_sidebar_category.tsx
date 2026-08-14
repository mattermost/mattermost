// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {isValidElement} from 'react';
import {NavLink} from 'react-router-dom';

type Props = {
    icon: JSX.Element;
    title: string | JSX.Element;
    action?: JSX.Element;
    children?: React.ReactNode;
    definitionKey?: string;
    name?: string;
    parentLink?: string;
    sectionClass?: string;
};

const AdminSidebarCategory = ({icon, title, action, children, definitionKey, name, parentLink = '', sectionClass}: Props) => {
    let link = parentLink;
    let titleDiv = (
        <div
            className='category-title category-title--active'
            data-testid='sidebar-category-title'
        >
            <span className='category-icon'>{icon}</span>
            <span className='category-title__text'>
                {title}
            </span>
            {action}
        </div>
    );

    if (name) {
        link += '/' + name;
        titleDiv = (
            <NavLink
                to={link}
                className='category-title'
                activeClassName='category-title category-title--active'
                data-testid='sidebar-category-title'
            >
                {title}
            </NavLink>
        );
    }

    let clonedChildren = null;
    const sectionsClassName = classNames('sections', sectionClass);
    if (children) {
        clonedChildren = (
            <ul
                className={sectionsClassName}
                data-testid='sidebar-category-sections'
            >
                {
                    React.Children.map(children, (child) => {
                        if (!isValidElement(child)) {
                            return null;
                        }

                        return React.cloneElement(child as JSX.Element, {
                            parentLink: link,
                        });
                    })
                }
            </ul>
        );
    }

    return (
        <li
            className='sidebar-category'
            data-testid={definitionKey}
        >
            {titleDiv}
            {clonedChildren}
        </li>
    );
};

export default AdminSidebarCategory;
