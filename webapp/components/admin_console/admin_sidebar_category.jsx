import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {Link} from 'react-router/es6';

export default class AdminSidebarCategory extends React.Component {
    static get propTypes() {
        return {
            name: PropTypes.string,
            title: PropTypes.node.isRequired,
            icon: PropTypes.string.isRequired,
            sectionClass: PropTypes.string,
            parentLink: PropTypes.string,
            children: PropTypes.node,
            action: PropTypes.node
        };
    }

    static get defaultProps() {
        return {
            parentLink: ''
        };
    }

    static get contextTypes() {
        return {
            router: PropTypes.object.isRequired
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
