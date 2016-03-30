// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {Link} from 'react-router';

export default class AddIntegrationOption extends React.Component {
    static get propTypes() {
        return {
            image: React.PropTypes.string.isRequired,
            title: React.PropTypes.node.isRequired,
            description: React.PropTypes.node.isRequired,
            link: React.PropTypes.string.isRequired
        };
    }

    render() {
        const {image, title, description, link} = this.props;

        return (
            <Link
                to={link}
                className='add-integration-option'
            >
                <img
                    className='add-integration-option__image'
                    src={image}
                />
                <div className='add-integration-option__title'>
                    {title}
                </div>
                <div className='add-integration-option__description'>
                    {description}
                </div>
            </Link>
        );
    }
}
