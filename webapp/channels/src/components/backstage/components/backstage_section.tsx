// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import {NavLink} from 'react-router-dom';

type Props = {
    name: string;
    title: ReactNode;
    subsection?: boolean;
    parentLink?: string;
    children?: JSX.Element[];
    id?: string;
}

const BackstageSection = ({name, title, subsection = false, parentLink = '', children = [], id}: Props) => {
    const link = parentLink + '/' + name;

    let clonedChildren = null;
    if (children.length > 0) {
        clonedChildren = (
            <ul className='subsections'>
                {
                    React.Children.map(children, (child) => {
                        return React.cloneElement(child, {
                            parentLink: link,
                            subsection: true,
                        });
                    })
                }
            </ul>
        );
    }

    const className = subsection ? 'subsection' : 'section';

    return (
        <li
            className={className}
            id={id}
        >
            <NavLink
                className={`${className}-title`}
                activeClassName={`${className}-title--active`}
                to={link}
            >
                <span className={`${className}-title__text`}>
                    {title}
                </span>
            </NavLink>
            {clonedChildren}
        </li>
    );
};

export default BackstageSection;
