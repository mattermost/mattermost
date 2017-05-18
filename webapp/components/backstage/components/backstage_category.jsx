import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {Link} from 'react-router/es6';

export default class BackstageCategory extends React.Component {
    static get propTypes() {
        return {
            name: PropTypes.string.isRequired,
            title: PropTypes.node.isRequired,
            icon: PropTypes.string.isRequired,
            parentLink: PropTypes.string,
            children: PropTypes.arrayOf(PropTypes.element)
        };
    }

    static get defaultProps() {
        return {
            parentLink: '',
            children: []
        };
    }

    static get contextTypes() {
        return {
            router: PropTypes.object.isRequired
        };
    }

    render() {
        const {name, title, icon, parentLink, children} = this.props;

        const link = parentLink + '/' + name;

        let clonedChildren = null;
        if (children.length > 0 && this.context.router.isActive(link)) {
            clonedChildren = (
                <ul className='sections'>
                    {
                        React.Children.map(children, (child) => {
                            if (!child) {
                                return child;
                            }

                            return React.cloneElement(child, {
                                parentLink: link
                            });
                        })
                    }
                </ul>
            );
        }

        return (
            <li className='backstage-sidebar__category'>
                <Link
                    to={link}
                    className='category-title'
                    activeClassName='category-title--active'
                    onlyActiveOnIndex={true}
                >
                    <i className={'fa ' + icon}/>
                    <span className='category-title__text'>
                        {title}
                    </span>
                </Link>
                {clonedChildren}
            </li>
        );
    }
}
