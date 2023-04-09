// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';
import {Link} from 'react-router-dom';

import './alternate_link.scss';

type AlternateLinkProps = {
    className?: string;
    onClick?: () => void;
    alternateMessage?: string;
    alternateLinkPath?: string;
    alternateLinkLabel?: string;
}

const AlternateLink = ({className, onClick = () => {}, alternateMessage, alternateLinkPath, alternateLinkLabel}: AlternateLinkProps) => {
    if (!alternateMessage && !alternateLinkPath && !alternateLinkLabel) {
        return null;
    }

    return (
        <div
            className={classNames('alternate-link', className)}
            data-testid='alternate-link'
        >
            {alternateMessage && (
                <span className='alternate-link__message'>
                    {alternateMessage}
                </span>
            )}
            {alternateLinkPath && alternateLinkLabel && (
                <Link
                    className='alternate-link__link'
                    to={{
                        pathname: alternateLinkPath,
                        search: location.search,
                    }}
                    onClick={onClick}
                >
                    {alternateLinkLabel}
                </Link>
            )}
        </div>
    );
};

export default AlternateLink;
