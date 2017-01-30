// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {Link} from 'react-router/es6';

export default class AdminSidebarCategory extends React.Component {
    static get propTypes() {
        return {
            name: React.PropTypes.string,
            title: React.PropTypes.node.isRequired,
            icon: React.PropTypes.string.isRequired,
            sectionClass: React.PropTypes.string,
            parentLink: React.PropTypes.string,
            children: React.PropTypes.node,
            action: React.PropTypes.node
        };
    }

    static get defaultProps() {
        return {
            parentLink: ''
        };
    }

    static get contextTypes() {
        return {
            router: React.PropTypes.object.isRequired
        };
    }

    render() {
        let link = this.props.parentLink;
        let title = (
            <div className='category-title category-title--active'>
                <i className={'category-icon fa ' + this.props.icon}/>
                <span className='category-title__text'>
                    {this.props.title}
                </span>
                {this.props.action}
            </div>
        );

        if (this.props.name) {
            link += '/' + name;
            title = (
                <Link
                    to={link}
                    className='category-title'
                    activeClassName='category-title category-title--active'
                >
                    {title}
                </Link>
            );
        }

        let clonedChildren = null;
        if (this.props.children && this.context.router.isActive(link)) {
            clonedChildren = (
                <ul className={'sections ' + this.props.sectionClass}>
                    {
                        React.Children.map(this.props.children, (child) => {
                            if (child === null) {
                                return null;
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
            <li className='sidebar-category'>
                {title}
                {clonedChildren}
            </li>
        );
    }
}
