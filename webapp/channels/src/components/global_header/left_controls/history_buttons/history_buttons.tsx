// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';
import styled from 'styled-components';

import IconButton from '@mattermost/compass-components/components/icon-button'; // eslint-disable-line no-restricted-imports

import {trackEvent} from 'actions/telemetry_actions';

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import type {
    KeyboardShortcutDescriptor} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import WithTooltip from 'components/with_tooltip';

import DesktopApp from 'utils/desktop_api';

const HistoryButtonsContainer = styled.nav`
    display: flex;
    align-items: center;

    > :first-child {
           margin-right: 1px;
    }
`;

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
            <WithTooltip
                title={getTooltip(KEYBOARD_SHORTCUTS.browserChannelPrev)}
            >
                <IconButton
                    icon={'arrow-left'}
                    onClick={goBack}
                    size={'sm'}
                    compact={true}
                    inverted={true}
                    disabled={!canGoBack}
                    aria-label={intl.formatMessage({id: 'sidebar_left.channel_navigator.goBackLabel', defaultMessage: 'Back'})}
                />
            </WithTooltip>
            <WithTooltip
                title={getTooltip(KEYBOARD_SHORTCUTS.browserChannelNext)}
            >
                <IconButton
                    icon={'arrow-right'}
                    onClick={goForward}
                    size={'sm'}
                    compact={true}
                    inverted={true}
                    disabled={!canGoForward}
                    aria-label={intl.formatMessage({id: 'sidebar_left.channel_navigator.goForwardLabel', defaultMessage: 'Forward'})}
                />
            </WithTooltip>
        </HistoryButtonsContainer>
    );
};

export default HistoryButtons;
