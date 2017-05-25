import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default class BackstageHeader extends React.Component {
    static get propTypes() {
        return {
            children: PropTypes.node
        };
    }

    render() {
        const children = [];

        React.Children.forEach(this.props.children, (child, index) => {
            if (index !== 0) {
                children.push(
                    <span
                        key={'divider' + index}
                        className='backstage-header__divider'
                    >
                        <i className='fa fa-angle-right'/>
                    </span>
                );
            }

            children.push(child);
        });

        return (
            <div className='backstage-header'>
                <h1>
                    {children}
                </h1>
            </div>
        );
    }
}
