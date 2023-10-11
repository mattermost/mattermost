// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import UnreadBelowIcon from 'components/widgets/icons/unread_below_icon';

import './unread_channel_indicator.scss';

type Props = {

    /**
     * Function to call when the indicator is clicked
     */
    onClick: (event: React.MouseEvent<HTMLDivElement>) => void;

    /**
     * Set whether to show the indicator or not
     */
    show?: boolean;

    /**
     * The additional CSS class for the indicator
     */
    extraClass?: string;

    /**
     * The content of the indicator
     */
    content?: React.ReactNode;

    /**
     * The name of the indicator
     */
    name?: string;
}

function UnreadChannelIndicator(props: Props) {
    return (
        <div
            id={'unreadIndicator' + props.name}
            className={classNames('nav-pills__unread-indicator', {
                'nav-pills__unread-indicator--visible': props.show,
            }, props.extraClass)}
            onClick={props.onClick}
        >
            <UnreadBelowIcon className='icon icon__unread'/>
            {props.content}
        </div>
    );
}

UnreadChannelIndicator.defaultProps = {
    show: false,
    extraClass: '',
    content: '',
};

export default UnreadChannelIndicator;
