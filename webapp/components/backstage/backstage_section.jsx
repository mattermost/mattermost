// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {Link} from 'react-router';

export default class BackstageSection extends React.Component {
    static get propTypes() {
        return {
            name: React.PropTypes.string.isRequired,
            title: React.PropTypes.node.isRequired,
            parentLink: React.PropTypes.string,
            subsection: React.PropTypes.bool,
            children: React.PropTypes.arrayOf(React.PropTypes.element)
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
            router: React.PropTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);

        this.state = {
            expanded: true
        };
    }

    getLink() {
        return this.props.parentLink + '/' + this.props.name;
    }

    isActive() {
        const link = this.getLink();

        return this.context.router.isActive(link);
    }

    handleClick(e) {
        if (this.isActive()) {
            // we're already on this page so just toggle the link
            e.preventDefault();

            this.setState({
                expanded: !this.state.expanded
            });
        }

        // otherwise, just follow the link
    }

    render() {
        const {title, subsection, children} = this.props;

        const link = this.getLink();
        const active = this.isActive();

        // act like docs.mattermost.com and only expand if this link is active
        const expanded = active && this.state.expanded;

        let toggle = null;
        if (children.length > 0) {
            if (expanded) {
                toggle = <i className='fa fa-minus-square-o'/>;
            } else {
                toggle = <i className='fa fa-plus-square-o'/>;
            }
        }

        let clonedChildren = null;
        if (children.length > 0 && expanded) {
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
                    onClick={this.handleClick}
                    to={link}
                >
                    {toggle}
                    <span className={`${className}-title__text`}>
                        {title}
                    </span>
                </Link>
                {clonedChildren}
            </li>
        );
    }
}
