// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {Link} from 'react-router/es6';

export default class BackstageCategory extends React.Component {
    static get propTypes() {
        return {
            name: React.PropTypes.string.isRequired,
            title: React.PropTypes.node.isRequired,
            icon: React.PropTypes.string.isRequired,
            parentLink: React.PropTypes.string,
            children: React.PropTypes.arrayOf(React.PropTypes.element)
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
            router: React.PropTypes.object.isRequired
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
