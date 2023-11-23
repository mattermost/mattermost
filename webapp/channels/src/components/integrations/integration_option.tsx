// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Link} from 'react-router-dom';

type Props = {
    image: string;
    title: JSX.Element;
    description: JSX.Element;
    link: string;
}

const IntegrationOption = ({image, title, description, link}: Props) => {
    return (
        <Link
            to={link}
            className='integration-option'
        >
            <img
                alt={'integration image'}
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
};

export default React.memo(IntegrationOption);
