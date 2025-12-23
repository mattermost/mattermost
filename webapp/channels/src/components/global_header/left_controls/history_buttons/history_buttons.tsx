// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';

import HeaderIconButton from 'components/global_header/header_icon_button';
import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import type {
    KeyboardShortcutDescriptor} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import WithTooltip from 'components/with_tooltip';

import DesktopApp from 'utils/desktop_api';

const HistoryButtons = (): JSX.Element => {
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
        <div className='globalHeader-history-buttons'>
            <WithTooltip
                title={getTooltip(KEYBOARD_SHORTCUTS.browserChannelPrev)}
            >
                <HeaderIconButton
                    icon={'arrow-left'}
                    onClick={goBack}
                    disabled={!canGoBack}
                    aria-label={intl.formatMessage({id: 'sidebar_left.channel_navigator.goBackLabel', defaultMessage: 'Back'})}
                />
            </WithTooltip>
            <WithTooltip
                title={getTooltip(KEYBOARD_SHORTCUTS.browserChannelNext)}
            >
                <HeaderIconButton
                    icon={'arrow-right'}
                    onClick={goForward}
                    disabled={!canGoForward}
                    aria-label={intl.formatMessage({id: 'sidebar_left.channel_navigator.goForwardLabel', defaultMessage: 'Forward'})}
                />
            </WithTooltip>
        </div>
    );
};

export default HistoryButtons;
