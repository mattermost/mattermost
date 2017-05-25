import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {Link} from 'react-router/es6';

export default class IntegrationOption extends React.Component {
    static get propTypes() {
        return {
            image: PropTypes.string.isRequired,
            title: PropTypes.node.isRequired,
            description: PropTypes.node.isRequired,
            link: PropTypes.string.isRequired
        };
    }

    render() {
        const {image, title, description, link} = this.props;

        return (
            <Link
                to={link}
                className='integration-option'
            >
                <img
                    className='integration-option__image'
                    src={image}
                />
                <div className='integration-option__title'>
                    {title}
                </div>
                <div className='integration-option__description'>
                    {description}
                </div>
            </Link>
        );
    }
}
