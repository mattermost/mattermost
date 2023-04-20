// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    title?: JSX.Element;
    description: JSX.Element;
}

const Banner: React.FC<Props> = (props: Props) => {
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
};

export default Banner;
