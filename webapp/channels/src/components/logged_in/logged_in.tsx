// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Redirect} from 'react-router-dom';

import type {UserProfile} from '@mattermost/types/users';

import * as GlobalActions from 'actions/global_actions';
import * as WebSocketActions from 'actions/websocket_actions.jsx';
import BrowserStore from 'stores/browser_store';

import LoadingScreen from 'components/loading_screen';

import WebSocketClient from 'client/web_websocket_client';
import Constants from 'utils/constants';
import DesktopApp from 'utils/desktop_api';
import {isKeyPressed} from 'utils/keyboard';
import {getBrowserTimezone} from 'utils/timezone';
import * as UserAgent from 'utils/user_agent';

declare global {
    interface Window {
        desktop: {
            version?: string | null;
        };
    }
}

export type Props = {
    currentUser?: UserProfile;
    currentChannelId?: string;
    isCurrentChannelManuallyUnread: boolean;
    children?: React.ReactNode;
    mfaRequired: boolean;
    actions: {
        autoUpdateTimezone: (deviceTimezone: string) => void;
        getChannelURLAction: (channelId: string, teamId: string, url: string) => void;
        updateApproximateViewTime: (channelId: string) => void;
    };
    showTermsOfService: boolean;
    location: {
        pathname: string;
        search: string;
    };
}

export default class LoggedIn extends React.PureComponent<Props> {
    private cleanupDesktopListeners?: () => void;

    constructor(props: Props) {
        super(props);

        const root = document.getElementById('root');
        if (root) {
            root.className += ' channel-view';
        }
    }

    private isValidState(): boolean {
        return this.props.currentUser != null;
    }

    public componentDidMount(): void {
        // Initialize websocket
        WebSocketActions.initialize();

        this.updateTimeZone();

        // Make sure the websockets close and reset version
        window.addEventListener('beforeunload', this.handleBeforeUnload);

        // listen for the app visibility state
        window.addEventListener('visibilitychange', this.handleVisibilityChange, false);

        // Listen for focused tab/window state
        window.addEventListener('focus', this.onFocusListener);
        window.addEventListener('blur', this.onBlurListener);
        if (!document.hasFocus()) {
            GlobalActions.emitBrowserFocus(false);
        }

        // Listen for user activity and notifications from the Desktop App (if applicable)
        const offUserActivity = DesktopApp.onUserActivityUpdate(this.updateActiveStatus);
        const offNotificationClicked = DesktopApp.onNotificationClicked(this.clickNotification);
        this.cleanupDesktopListeners = () => {
            offUserActivity();
            offNotificationClicked();
        };

        // Device tracking setup
        if (UserAgent.isIos()) {
            document.body.classList.add('ios');
        } else if (UserAgent.isAndroid()) {
            document.body.classList.add('android');
        }

        if (!this.props.currentUser) {
            const rootEl = document.getElementById('root');
            if (rootEl) {
                rootEl.setAttribute('class', '');
            }
            GlobalActions.emitUserLoggedOutEvent('/login?redirect_to=' + encodeURIComponent(`${this.props.location.pathname}${this.props.location.search}`), true, false);
        }

        // Prevent backspace from navigating back a page
        window.addEventListener('keydown', this.handleBackSpace);

        if (this.isValidState() && !this.props.mfaRequired) {
            BrowserStore.signalLogin();
            DesktopApp.signalLogin();
        }
    }

    public componentWillUnmount(): void {
        WebSocketActions.close();

        window.removeEventListener('keydown', this.handleBackSpace);

        window.removeEventListener('focus', this.onFocusListener);
        window.removeEventListener('blur', this.onBlurListener);

        this.cleanupDesktopListeners?.();
    }

    public render(): React.ReactNode {
        if (!this.isValidState()) {
            return <LoadingScreen/>;
        }

        if (this.props.mfaRequired) {
            if (this.props.location.pathname !== '/mfa/setup') {
                return <Redirect to={'/mfa/setup'}/>;
            }
        } else if (this.props.location.pathname === '/mfa/confirm') {
            // Nothing to do. Wait for MFA flow to complete before prompting TOS.
        } else if (this.props.showTermsOfService) {
            if (this.props.location.pathname !== '/terms_of_service') {
                return <Redirect to={'/terms_of_service?redirect_to=' + encodeURIComponent(this.props.location.pathname)}/>;
            }
        }

        return this.props.children;
    }

    private handleVisibilityChange = (): void => {
        if (!document.hidden) {
            this.updateTimeZone();
        }
    };

    private updateTimeZone(): void {
        this.props.actions.autoUpdateTimezone(getBrowserTimezone());
    }

    private onFocusListener(): void {
        GlobalActions.emitBrowserFocus(true);
    }

    private onBlurListener(): void {
        GlobalActions.emitBrowserFocus(false);
    }

    private updateActiveStatus = (userIsActive: boolean, idleTime: number, manual: boolean) => {
        if (!this.props.currentUser) {
            return;
        }

        // update the server with the users current away status
        if (userIsActive === true || userIsActive === false) {
            WebSocketClient.userUpdateActiveStatus(userIsActive, manual);
        }
    };

    private clickNotification = (channelId: string, teamId: string, url: string) => {
        window.focus();

        // navigate to the appropriate channel
        this.props.actions.getChannelURLAction(channelId, teamId, url);
    };

    private handleBackSpace = (e: KeyboardEvent): void => {
        const excludedElements = ['input', 'textarea'];
        const targetElement = e.target as HTMLElement;

        if (!targetElement) {
            return;
        }

        const targetsTagName = targetElement.tagName.toLowerCase();
        const isTargetNotContentEditable = targetElement.getAttribute?.('contenteditable') !== 'true';

        if (
            isKeyPressed(e, Constants.KeyCodes.BACKSPACE) &&
            !(excludedElements.includes(targetsTagName)) &&
            isTargetNotContentEditable
        ) {
            e.preventDefault();
        }
    };

    private handleBeforeUnload = (): void => {
        // remove the event listener to prevent getting stuck in a loop
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        if (document.cookie.indexOf('MMUSERID=') > -1 && this.props.currentChannelId && !this.props.isCurrentChannelManuallyUnread) {
            this.props.actions.updateApproximateViewTime(this.props.currentChannelId);
        }
        WebSocketActions.close();
    };
}
