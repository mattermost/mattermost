// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {localizeMessage} from 'utils/utils';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import {Locations} from 'utils/constants';
import ThreadIconRHS from './thread_icon_rhs';

type Props = {
    location: keyof typeof Locations;
    handleJumpClick: React.EventHandler<React.MouseEvent>;
    postId?: string;
    href: string;
}

export default class ThreadsViewer extends React.PureComponent<Props> {
    public static defaultProps: Partial<Props> = {
        location: 'CENTER',
    };

    public render(): JSX.Element {
        const iconStyle = 'post-menu__item';

        const tooltip = (
            <Tooltip
                id='thread-icon-tooltip'
                className='hidden-xs'
            >
                <FormattedMessage
                    id='post_info.viewThread_icon.tooltip.thread'
                    defaultMessage='View Thread'
                />
            </Tooltip>
        );

        return (
            <OverlayTrigger
                delayShow={500}
                placement='top'
                overlay={tooltip}
            >
                <button
                    type='button'
                    id={`${this.props.location}_commentIcon_${this.props.postId}`}
                    aria-label={localizeMessage('post_info.viewThread_icon.tooltip.thread', 'View Thread').toLowerCase()}
                    className={iconStyle}
                    onClick={this.props.handleJumpClick}
                >
                    <ThreadIconRHS className='icon--small icon--thread'/>
                </button>
            </OverlayTrigger>
        );
    }
}

