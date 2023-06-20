// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {trackEvent} from 'actions/telemetry_actions.jsx';
import Markdown from 'components/markdown';

import alertIcon from 'images/icons/round-white-info-icon.svg';

import AnnouncementBar from './default_announcement_bar';

const localStoragePrefix = '__announcement__';

type AnnouncementBarProps = React.ComponentProps<typeof AnnouncementBar>;

interface Props extends Partial<AnnouncementBarProps> {
    allowDismissal: boolean;
    text: React.ReactNode;
    onDismissal?: () => void;
}

type State = {
    dismissed: boolean;
}

export default class TextDismissableBar extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            dismissed: true,
        };
    }

    static getDerivedStateFromProps(props: Props) {
        const dismissed = localStorage.getItem(localStoragePrefix + props.text?.toString());
        return {
            dismissed: (dismissed === 'true'),
        };
    }

    handleDismiss = () => {
        if (!this.props.allowDismissal) {
            return;
        }
        trackEvent('signup', 'click_dismiss_bar');

        localStorage.setItem(localStoragePrefix + this.props.text?.toString(), 'true');
        this.setState({
            dismissed: true,
        });
        if (this.props.onDismissal) {
            this.props.onDismissal();
        }
    };

    render() {
        if (this.state.dismissed) {
            return null;
        }
        const {allowDismissal, text, ...extraProps} = this.props;
        return (
            <AnnouncementBar
                {...extraProps}
                showCloseButton={allowDismissal}
                handleClose={this.handleDismiss}
                message={
                    <>
                        <img
                            className='advisor-icon'
                            src={alertIcon}
                        />
                        {typeof text === 'string' ? (
                            <Markdown
                                message={text}
                                options={{
                                    singleline: true,
                                    mentionHighlight: false,
                                }}
                            />
                        ) : text}
                    </>
                }
            />
        );
    }
}

