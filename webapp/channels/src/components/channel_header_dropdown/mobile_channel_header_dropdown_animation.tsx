// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import {CSSTransition} from 'react-transition-group';

const ANIMATION_DURATION = 350;

type Props = {
    children?: ReactNode;
    show: boolean;
}

export default class MobileChannelHeaderDropdownAnimation extends React.PureComponent<Props> {
    render() {
        return (
            <CSSTransition
                in={this.props.show}
                classNames='mobile-channel-header-dropdown'
                enter={true}
                exit={true}
                mountOnEnter={true}
                unmountOnExit={true}
                timeout={{
                    enter: ANIMATION_DURATION,
                    exit: ANIMATION_DURATION,
                }}
            >
                {this.props.children}
            </CSSTransition>
        );
    }
}

