import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default function Banner(props) {
    let title = (
        <FormattedMessage
            id='admin.banner.heading'
            defaultMessage='Note:'
        />
    );

    if (props.title) {
        title = props.title;
    }

    return (
        <div className='banner'>
            <div className='banner__content'>
                <h4 className='banner__heading'>
                    {title}
                </h4>
                <p>
                    {props.description}
                </p>
            </div>
        </div>
    );
}

Banner.defaultProps = {
};
Banner.propTypes = {
    title: PropTypes.node,
    description: PropTypes.node.isRequired
};
