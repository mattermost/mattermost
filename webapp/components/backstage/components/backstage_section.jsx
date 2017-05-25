import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {Link} from 'react-router/es6';

export default class BackstageSection extends React.Component {
    static get propTypes() {
        return {
            name: PropTypes.string.isRequired,
            title: PropTypes.node.isRequired,
            parentLink: PropTypes.string,
            subsection: PropTypes.bool,
            children: PropTypes.arrayOf(PropTypes.element)
        };
    }

    static get defaultProps() {
        return {
            parentLink: '',
            subsection: false,
            children: []
        };
    }

    static get contextTypes() {
        return {
            router: PropTypes.object.isRequired
        };
    }

    getLink() {
        return this.props.parentLink + '/' + this.props.name;
    }

    render() {
        const {title, subsection, children} = this.props;

        const link = this.getLink();

        let clonedChildren = null;
        if (children.length > 0) {
            clonedChildren = (
                <ul className='subsections'>
                    {
                        React.Children.map(children, (child) => {
                            return React.cloneElement(child, {
                                parentLink: link,
                                subsection: true
                            });
                        })
                    }
                </ul>
            );
        }

        let className = 'section';
        if (subsection) {
            className = 'subsection';
        }

        return (
            <li className={className}>
                <Link
                    className={`${className}-title`}
                    activeClassName={`${className}-title--active`}
                    to={link}
                >
                    <span className={`${className}-title__text`}>
                        {title}
                    </span>
                </Link>
                {clonedChildren}
            </li>
        );
    }
}
