// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';

type Props = {

    /**
     * URL to return to
     */
    url?: string;

    className?: string;

    /**
     * onClick handler when user clicks back button
     */
    onClick?: React.EventHandler<React.MouseEvent>;
}

const HistoryBackButton = ({url = '/', className, onClick}: Props): JSX.Element => {
    const {formatMessage} = useIntl();

    return (
        <div className={classNames('signup-header', className)}>
            <Link
                data-testid='back_button'
                onClick={onClick}
                to={url}
            >
                <span
                    id='back_button_icon'
                    className='fa fa-1x fa-angle-left'
                    title={formatMessage({id: 'generic_icons.back', defaultMessage: 'Back Icon'})}
                />
                <FormattedMessage
                    id='web.header.back'
                    defaultMessage='Back'
                />
            </Link>
        </div>
    );
};

export default HistoryBackButton;
