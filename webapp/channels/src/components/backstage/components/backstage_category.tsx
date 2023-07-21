// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {ReactNode} from 'react';
import {Route, NavLink} from 'react-router-dom';

type Props = {
    name: string;
    title: ReactNode;
    icon: string;
    parentLink?: string;
    children?: ReactNode[];
}

const BackstageCategory = ({name, title, icon, parentLink, children = []}: Props) => {
    const link = parentLink + '/' + name;

    return (
        <li className='backstage-sidebar__category'>
            <NavLink
                to={link}
                className='category-title'
                activeClassName='category-title--active'
            >
                <i className={classNames('fa ', icon)}/>
                <span className='category-title__text'>
                    {title}
                </span>
            </NavLink>
            {
                children && children.length > 0 &&
                    <Route
                        path={link}
                        render={() => (
                            <ul className='sections'>
                                {
                                    React.Children.map(children, (child) => {
                                        if (!child) {
                                            return child;
                                        }

                                        return React.cloneElement(child as JSX.Element, {
                                            parentLink: link,
                                        });
                                    })
                                }
                            </ul>
                        )}
                    />
            }
        </li>
    );
};

export default BackstageCategory;
