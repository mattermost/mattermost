// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';

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

const options = {
    singleline: true,
    mentionHighlight: false,
};

const getDismissed = (text?: React.ReactNode) => localStorage.getItem(localStoragePrefix + text?.toString()) === 'true';

const TextDismissableBar = ({
    allowDismissal,
    text,
    onDismissal,
    ...extraProps
}: Props) => {
    const [dismissed, setDismissed] = useState<boolean>(() => getDismissed(text));

    useEffect(() => {
        setDismissed(getDismissed(text));
    }, [text]);

    const handleDismiss = useCallback(() => {
        if (!allowDismissal) {
            return;
        }
        trackEvent('signup', 'click_dismiss_bar');

        localStorage.setItem(localStoragePrefix + text?.toString(), 'true');
        setDismissed(true);
        onDismissal?.();
    }, [allowDismissal, onDismissal, text]);

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
                            options={options}
                        />
                    ) : text}
                </>
            }
        />
    );
};

export default TextDismissableBar;
