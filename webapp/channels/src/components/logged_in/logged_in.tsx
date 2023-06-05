// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Redirect} from 'react-router-dom';

import semver from 'semver';

import * as GlobalActions from 'actions/global_actions';
import * as WebSocketActions from 'actions/websocket_actions.jsx';
import * as UserAgent from 'utils/user_agent';
import LoadingScreen from 'components/loading_screen';
import {getBrowserTimezone} from 'utils/timezone';
import WebSocketClient from 'client/web_websocket_client.jsx';
import BrowserStore from 'stores/browser_store';
import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';

const BACKSPACE_CHAR = 8;

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
    children?: React.ReactNode;
    mfaRequired: boolean;
    enableTimezone: boolean;
    actions: {
        autoUpdateTimezone: (deviceTimezone: string) => void;
        getChannelURLAction: (channel: Channel, teamId: string, url: string) => void;
        viewChannel: (channelId: string, prevChannelId?: string) => void;
    };
    showTermsOfService: boolean;
    location: {
        pathname: string;
        search: string;
    };
}

type DesktopMessage = {
    origin: string;
    data: {
        type: string;
        message: {
            version: string;
            userIsActive: boolean;
            manual: boolean;
            channel: Channel;
            teamId: string;
            url: string;
        };
    };
}

export default class LoggedIn extends React.PureComponent<Props> {
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

        if (this.props.enableTimezone) {
            this.props.actions.autoUpdateTimezone(getBrowserTimezone());
        }

        // Make sure the websockets close and reset version
        window.addEventListener('beforeunload', this.handleBeforeUnload);

        // Listen for focused tab/window state
        window.addEventListener('focus', this.onFocusListener);
        window.addEventListener('blur', this.onBlurListener);
        if (!document.hasFocus()) {
            GlobalActions.emitBrowserFocus(false);
        }

        // Listen for messages from the desktop app
        window.addEventListener('message', this.onDesktopMessageListener);

        // Tell the desktop app the webapp is ready
        window.postMessage(
            {
                type: 'webapp-ready',
            },
            window.location.origin,
        );

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
        }
    }

    public componentWillUnmount(): void {
        WebSocketActions.close();

        window.removeEventListener('keydown', this.handleBackSpace);

        window.removeEventListener('focus', this.onFocusListener);
        window.removeEventListener('blur', this.onBlurListener);
        window.removeEventListener('message', this.onDesktopMessageListener);
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

    private onFocusListener(): void {
        GlobalActions.emitBrowserFocus(true);
    }

    private onBlurListener(): void {
        GlobalActions.emitBrowserFocus(false);
    }

    // listen for messages from the desktop app
    // TODO: This needs to be deprecated in favour of a more solid Desktop App API.
    private onDesktopMessageListener = (desktopMessage: DesktopMessage) => {
        if (!this.props.currentUser) {
            return;
        }
        if (desktopMessage.origin !== window.location.origin) {
            return;
        }

        switch (desktopMessage.data.type) {
        case 'register-desktop': {
            // Currently used by calls
            const {version} = desktopMessage.data.message;
            if (!window.desktop) {
                window.desktop = {};
            }
            window.desktop.version = semver.valid(semver.coerce(version));
            break;
        }
        case 'user-activity-update': {
            const {userIsActive, manual} = desktopMessage.data.message;

            // update the server with the users current away status
            if (userIsActive === true || userIsActive === false) {
                WebSocketClient.userUpdateActiveStatus(userIsActive, manual);
            }
            break;
        }
        case 'notification-clicked': {
            const {channel, teamId, url} = desktopMessage.data.message;
            window.focus();

            // navigate to the appropriate channel
            this.props.actions.getChannelURLAction(channel, teamId, url);
            break;
        }
        }
    };

    private handleBackSpace = (e: KeyboardEvent): void => {
        const excludedElements = ['input', 'textarea'];

        if (
            e.which === BACKSPACE_CHAR && e.target &&
            !(excludedElements.includes((e.target as HTMLElement).tagName.toLowerCase())) &&
            (e.target as HTMLElement).getAttribute?.('contenteditable') !== 'true'
        ) {
            e.preventDefault();
        }
    };

    private handleBeforeUnload = (): void => {
        // remove the event listener to prevent getting stuck in a loop
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        if (document.cookie.indexOf('MMUSERID=') > -1) {
            this.props.actions.viewChannel('', this.props.currentChannelId || '');
        }
        WebSocketActions.close();
    };
}
