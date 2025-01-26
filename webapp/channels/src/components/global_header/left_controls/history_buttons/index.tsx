// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';

import {ArrowRightIcon, ArrowLeftIcon} from '@mattermost/compass-icons/components';

import {trackEvent} from 'actions/telemetry_actions';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import type {
    KeyboardShortcutDescriptor} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import WithTooltip from 'components/with_tooltip';

import DesktopApp from 'utils/desktop_api';

const HistoryButtons = () => {
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
        trackEvent('ui', 'ui_history_back');
        history.goBack();
        requestButtons();
    };

    const goForward = () => {
        trackEvent('ui', 'ui_history_forward');
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
        <nav className='history-buttons-container'>
            <WithTooltip
                title={getTooltip(KEYBOARD_SHORTCUTS.browserChannelPrev)}
            >
                <button
                    className='btn btn-icon btn-quaternary btn-inverted btn-sm buttons-in-globalHeader'
                    onClick={goBack}
                    disabled={!canGoBack}
                    aria-label={intl.formatMessage({id: 'sidebar_left.channel_navigator.goBackLabel', defaultMessage: 'Back'})}
                >
                    <ArrowLeftIcon size={20}/>
                </button>
            </WithTooltip>
            <WithTooltip
                title={getTooltip(KEYBOARD_SHORTCUTS.browserChannelNext)}
            >
                <button
                    className='btn btn-icon btn-quaternary btn-inverted btn-sm buttons-in-globalHeader'
                    onClick={goForward}
                    disabled={!canGoForward}
                    aria-label={intl.formatMessage({id: 'sidebar_left.channel_navigator.goForwardLabel', defaultMessage: 'Forward'})}
                >
                    <ArrowRightIcon size={20}/>
                </button>
            </WithTooltip>
        </nav>
    );
};

export default HistoryButtons;
