import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {Link} from 'react-router/es6';
import * as Utils from 'utils/utils.jsx';

export default class AdminSidebarSection extends React.Component {
    static get propTypes() {
        return {
            name: PropTypes.string.isRequired,
            title: PropTypes.node.isRequired,
            type: PropTypes.string,
            parentLink: PropTypes.string,
            subsection: PropTypes.bool,
            children: PropTypes.node,
            action: PropTypes.node,
            onlyActiveOnIndex: PropTypes.bool
        };
    }

    static get defaultProps() {
        return {
            parentLink: '',
            subsection: false,
            children: [],
            onlyActiveOnIndex: true
        };
    }

    getLink() {
        return this.props.parentLink + '/' + this.props.name;
    }

    render() {
        const link = this.getLink();

        let clonedChildren = null;
        if (this.props.children) {
            clonedChildren = (
                <ul className='nav nav__sub-menu subsections'>
                    {
                        React.Children.map(this.props.children, (child) => {
                            if (child === null) {
                                return null;
                            }

                            return React.cloneElement(child, {
                                parentLink: link,
                                subsection: true
                            });
                        })
                    }
                </ul>
            );
        }

        let className = 'sidebar-section';
        if (this.props.subsection) {
            className += ' sidebar-subsection';
        }

        let sidebarItem = (
            <Link
                id={Utils.createSafeId(this.props.name)}
                className={`${className}-title`}
                activeClassName={`${className}-title ${className}-title--active`}
                onlyActiveOnIndex={this.props.onlyActiveOnIndex}
                onClick={this.handleClick}
                to={link}
            >
                <span className={`${className}-title__text`}>
                    {this.props.title}
                </span>
                {this.props.action}
            </Link>
        );

        if (this.props.type === 'text') {
            sidebarItem = (
                <div
                    className={`${className}-title`}
                >
                    <span className={`${className}-title__text`}>
                        {this.props.title}
                    </span>
                    {this.props.action}
                </div>
            );
        }

        return (
            <li className={className}>
                {sidebarItem}
                {clonedChildren}
            </li>
        );
    }
}
