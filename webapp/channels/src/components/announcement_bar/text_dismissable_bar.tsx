// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import Markdown from 'components/markdown';

import AnnouncementBar from './default_announcement_bar';

const localStoragePrefix = '__announcement__';

type AnnouncementBarProps = React.ComponentProps<typeof AnnouncementBar>;

interface Props extends Partial<AnnouncementBarProps> {
    allowDismissal: boolean;
    text: React.ReactNode;
    onDismissal?: () => void;
    className?: string;
}

const TextDismissableBar = (props: Props) => {
    const {allowDismissal, text, ...extraProps} = props;
    const [dismissed, setDismissed] = useState<boolean>(false);

    useEffect(() => {
        const dismissedFromStorage = localStorage.getItem(localStoragePrefix + text?.toString());
        if (dismissedFromStorage === 'true') {
            setDismissed(true);
        }
    }, [text]);

    const handleDismiss = () => {
        if (!allowDismissal) {
            return;
        }
        trackEvent('signup', 'click_dismiss_bar');

        localStorage.setItem(localStoragePrefix + text?.toString(), 'true');
        setDismissed(
            true,
        );
        if (props.onDismissal) {
            props.onDismissal();
        }
    };

    if (dismissed) {
        return null;
    }

    return (
        <AnnouncementBar
            {...extraProps}
            showCloseButton={allowDismissal}
            handleClose={handleDismiss}
            message={
                <>
                    <i className='icon icon-information-outline'/>
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
};

export default TextDismissableBar;
