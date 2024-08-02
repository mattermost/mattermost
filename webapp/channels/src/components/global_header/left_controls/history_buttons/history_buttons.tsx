// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useHistory} from 'react-router-dom';
import styled from 'styled-components';

import IconButton from '@mattermost/compass-components/components/icon-button'; // eslint-disable-line no-restricted-imports

import {trackEvent} from 'actions/telemetry_actions';

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import type {
    KeyboardShortcutDescriptor} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants from 'utils/constants';
import DesktopApp from 'utils/desktop_api';
import * as Utils from 'utils/utils';

const HistoryButtonsContainer = styled.nav`
    display: flex;
    align-items: center;

    > :first-child {
           margin-right: 1px;
    }
`;

const HistoryButtons = (): JSX.Element => {
    const history = useHistory();

    const [canGoBack, setCanGoBack] = useState(true);
    const [canGoForward, setCanGoForward] = useState(true);

    const getTooltip = (shortcut: KeyboardShortcutDescriptor) => (
        <Tooltip
            id='upload-tooltip'
        >
            <KeyboardShortcutSequence
                shortcut={shortcut}
                hoistDescription={true}
                isInsideTooltip={true}
            />
        </Tooltip>
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
        <HistoryButtonsContainer>
            <OverlayTrigger
                trigger={['hover', 'focus']}
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='bottom'
                overlay={getTooltip(KEYBOARD_SHORTCUTS.browserChannelPrev)}
            >
                <IconButton
                    icon={'arrow-left'}
                    onClick={goBack}
                    size={'sm'}
                    compact={true}
                    inverted={true}
                    disabled={!canGoBack}
                    aria-label={Utils.localizeMessage('sidebar_left.channel_navigator.goBackLabel', 'Back')}
                />
            </OverlayTrigger>
            <OverlayTrigger
                trigger={['hover', 'focus']}
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='bottom'
                overlay={getTooltip(KEYBOARD_SHORTCUTS.browserChannelNext)}
            >
                <IconButton
                    icon={'arrow-right'}
                    onClick={goForward}
                    size={'sm'}
                    compact={true}
                    inverted={true}
                    disabled={!canGoForward}
                    aria-label={Utils.localizeMessage('sidebar_left.channel_navigator.goForwardLabel', 'Forward')}
                />
            </OverlayTrigger>
        </HistoryButtonsContainer>
    );
};

export default HistoryButtons;
