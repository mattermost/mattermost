// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {notifyMe} from 'actions/notification_actions';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide, selectPostById} from 'actions/views/rhs';
import {getSelectedPostId, getIsRhsOpen} from 'selectors/rhs';

import AdvancedTextEditor from 'components/advanced_text_editor/advanced_text_editor';
import ChannelInviteModal from 'components/channel_invite_modal';
import ChannelMembersModal from 'components/channel_members_modal';
import {useNotifyAdmin} from 'components/notify_admin_cta/notify_admin_cta';
import PostMessagePreview from 'components/post_view/post_message_preview';
import StartTrialFormModal from 'components/start_trial_form_modal';
import ThreadViewer from 'components/threading/thread_viewer';
import Timestamp from 'components/timestamp';
import UserSettingsModal from 'components/user_settings/modal';
import BotTag from 'components/widgets/tag/bot_tag';
import Avatar from 'components/widgets/users/avatar';

import {getHistory} from 'utils/browser_history';
import {ModalIdentifiers} from 'utils/constants';
import DesktopApp from 'utils/desktop_api';
import messageHtmlToComponent from 'utils/message_html_to_component';
import * as NotificationSounds from 'utils/notification_sounds';
import {formatText} from 'utils/text_formatting';
import {useWebSocket, useWebSocketClient, WebSocketContext} from 'utils/use_websocket';
import {imageURLForUser} from 'utils/utils';

import {openInteractiveDialog} from './interactive_dialog'; // This import has intentional side effects. Do not remove without research.
import Textbox from './textbox';

// Note: We can't directly use the hook here, but we can create a function that opens the external pricing page
// For plugins, we'll always try to open the external page and let the browser handle if it's blocked
const openPricingModalForPlugins = () => {
    (window as any).open('https://mattermost.com/pricing', '_blank', 'noopener,noreferrer');
};

interface WindowWithLibraries {
    React: typeof import('react');
    ReactDOM: typeof import('react-dom');
    ReactIntl: typeof import('react-intl');
    Redux: typeof import('redux');
    ReactRedux: typeof import('react-redux');
    ReactBootstrap: typeof import('react-bootstrap');
    ReactRouterDom: typeof import('react-router-dom');
    PropTypes: typeof import('prop-types');
    Luxon: typeof import('luxon');
    PostUtils: {
        formatText: typeof formatText;
        messageHtmlToComponent: (html: string, ...args: any[]) => JSX.Element;
    };
    openInteractiveDialog: typeof openInteractiveDialog;
    useNotifyAdmin: typeof useNotifyAdmin;
    WebappUtils: {
        modals: {
            openModal: typeof openModal;
            ModalIdentifiers: typeof ModalIdentifiers;
        };
        notificationSounds: {
            ring: typeof NotificationSounds.ring;
            stopRing: typeof NotificationSounds.stopRing;
        };
        sendDesktopNotificationToMe: typeof notifyMe;
        openUserSettings: (dialogProps: any) => void;
        browserHistory: ReturnType<typeof getHistory>;
    };
    openPricingModal: () => void;
    Components: {
        Textbox: typeof Textbox;
        Timestamp: typeof Timestamp;
        ChannelInviteModal: typeof ChannelInviteModal;
        ChannelMembersModal: typeof ChannelMembersModal;
        Avatar: typeof Avatar;
        imageURLForUser: typeof imageURLForUser;
        BotBadge: typeof BotTag;
        StartTrialFormModal: typeof StartTrialFormModal;
        ThreadViewer: typeof ThreadViewer;
        PostMessagePreview: typeof PostMessagePreview;
        AdvancedTextEditor: typeof AdvancedTextEditor;
    };
    ProductApi: {
        useWebSocket: typeof useWebSocket;
        useWebSocketClient: typeof useWebSocketClient;
        WebSocketProvider: typeof WebSocketContext;
        closeRhs: typeof closeRightHandSide;
        selectRhsPost: typeof selectPostById;
        getRhsSelectedPostId: typeof getSelectedPostId;
        getIsRhsOpen: typeof getIsRhsOpen;
    };
    DesktopApp: typeof DesktopApp;
}
declare let window: WindowWithLibraries;

// Common libraries exposed on window for plugins to use as Webpack externals.
window.React = require('react');
window.ReactDOM = require('react-dom');
window.ReactIntl = require('react-intl');
window.Redux = require('redux');
window.ReactRedux = require('react-redux');
window.ReactBootstrap = require('react-bootstrap');
window.ReactRouterDom = require('react-router-dom');
window.PropTypes = require('prop-types');
window.Luxon = require('luxon');

// Functions exposed on window for plugins to use.
window.PostUtils = {
    formatText,
    messageHtmlToComponent: (html: string, ...otherArgs: any[]) => {
        // Previously, this function took an extra isRHS argument as the second parameter. For backwards compatibility,
        // support calling this as either messageHtmlToComponent(html, options) or messageHtmlToComponent(html, isRhs, options)

        let options;
        if (otherArgs.length === 2) {
            options = otherArgs[1];
        } else if (otherArgs.length === 1 && typeof otherArgs[0] === 'object') {
            options = otherArgs[0];
        }

        return messageHtmlToComponent(html, options);
    },
};
window.openInteractiveDialog = openInteractiveDialog;
window.useNotifyAdmin = useNotifyAdmin;
window.WebappUtils = {
    get browserHistory() {
        return getHistory();
    },
    modals: {openModal, ModalIdentifiers},
    notificationSounds: {ring: NotificationSounds.ring, stopRing: NotificationSounds.stopRing},
    sendDesktopNotificationToMe: notifyMe,
    openUserSettings: (dialogProps) => openModal({
        modalId: ModalIdentifiers.USER_SETTINGS,
        dialogType: UserSettingsModal,
        dialogProps,
    }),
};

// For plugins, we provide a simple function that always tries to open the external pricing page
// This won't respect air-gapped status, but plugins shouldn't be calling this in air-gapped environments
window.openPricingModal = openPricingModalForPlugins;

// Components exposed on window FOR INTERNAL PLUGIN USE ONLY. These components may have breaking changes in the future
// outside of major releases. They will be replaced by common components once that project is more mature and able to
// guarantee better compatibility.
window.Components = {
    Textbox,
    Timestamp,
    ChannelInviteModal,
    ChannelMembersModal,
    Avatar,
    imageURLForUser,
    BotBadge: BotTag,
    StartTrialFormModal,
    ThreadViewer,
    PostMessagePreview,
    AdvancedTextEditor,
};

// This is a prototype of the Product API for use by internal plugins only while we transition to the proper architecture
// for them using module federation.
window.ProductApi = {
    useWebSocket,
    useWebSocketClient,
    WebSocketProvider: WebSocketContext,
    closeRhs: closeRightHandSide,
    selectRhsPost: selectPostById,
    getRhsSelectedPostId: getSelectedPostId,
    getIsRhsOpen,
};

// Desktop App module containing the app info and a series of helpers to work with legacy code
window.DesktopApp = DesktopApp;
