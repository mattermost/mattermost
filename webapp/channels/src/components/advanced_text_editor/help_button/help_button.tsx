// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import './help_button.scss';

type Props = {
    visible: boolean;
}

const HIDE_DELAY_MS = 150;

const HelpButton = ({visible}: Props): JSX.Element | null => {
    // Debounce visibility to allow click to register before hiding
    const [isVisible, setIsVisible] = useState(visible);

    useEffect(() => {
        if (visible) {
            // Show immediately when becoming visible
            setIsVisible(true);
            return undefined;
        }

        // Delay hiding to allow click events to register
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, HIDE_DELAY_MS);
        return () => clearTimeout(timer);
    }, [visible]);

    const handleClick = useCallback(() => {
        // Open help page in a new tab/window
        window.open('/help', '_blank', 'noopener,noreferrer');
    }, []);

    if (!isVisible) {
        return null;
    }

    return (
        <div className='HelpButton'>
            <button
                type='button'
                className='HelpButton__link'
                onClick={handleClick}
                aria-label='Messaging help'
            >
                <FormattedMessage
                    id='advanced_text_editor.help_link'
                    defaultMessage='Help'
                />
            </button>
        </div>
    );
};

export default memo(HelpButton);
