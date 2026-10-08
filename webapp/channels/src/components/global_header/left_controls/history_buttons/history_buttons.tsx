// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';

import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import type {
    KeyboardShortcutDescriptor} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

import DesktopApp from 'utils/desktop_api';

export const HistoryButtons = () => {
    const history = useHistory();
    const intl = useIntl();

    const [canGoBack, setCanGoBack] = useState(true);
    const [canGoForward, setCanGoForward] = useState(true);

    const getTooltip = (shortcut: KeyboardShortcutDescriptor) => (
        <KeyboardShortcutSequence
            shortcut={shortcut}
            hoistDescription={true}
            isInsideTooltip={true}
        />
    );

    const goBack = () => {
        history.goBack();
        requestButtons();
    };

    const goForward = () => {
        history.goForward();
        requestButtons();
    };

    const requestButtons = async () => {
        const {canGoBack, canGoForward} = await DesktopApp.getBrowserHistoryStatus();
        updateButtons(canGoBack, canGoForward);
    };

    const updateButtons = (enableBack: boolean, enableForward: boolean) => {
        setCanGoBack(enableBack);
        setCanGoForward(enableForward);
    };

    useEffect(() => {
        const off = DesktopApp.onBrowserHistoryStatusUpdated(updateButtons);
        return off;
    }, []);

    return (
        <div className='globalHeader-leftControls-historyButtons'>
            <WithTooltip
                title={getTooltip(KEYBOARD_SHORTCUTS.browserChannelPrev)}
            >
                <IconButton
                    style='inverted'
                    size='small'
                    padding='compact'
                    icon={
                        <i
                            className='icon icon-arrow-left'
                            aria-hidden='true'
                        />
                    }
                    onClick={goBack}
                    disabled={!canGoBack}
                    aria-label={intl.formatMessage({id: 'sidebar_left.channel_navigator.goBackLabel', defaultMessage: 'Back'})}
                />
            </WithTooltip>
            <WithTooltip
                title={getTooltip(KEYBOARD_SHORTCUTS.browserChannelNext)}
            >
                <IconButton
                    style='inverted'
                    size='small'
                    padding='compact'
                    icon={
                        <i
                            className='icon icon-arrow-right'
                            aria-hidden='true'
                        />
                    }
                    onClick={goForward}
                    disabled={!canGoForward}
                    aria-label={intl.formatMessage({id: 'sidebar_left.channel_navigator.goForwardLabel', defaultMessage: 'Forward'})}
                />
            </WithTooltip>
        </div>
    );
};
