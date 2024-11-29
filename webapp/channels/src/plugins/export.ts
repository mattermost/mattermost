// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {notifyMe} from 'actions/notification_actions';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide, selectPostById} from 'actions/views/rhs';
import {getSelectedPostId, getIsRhsOpen} from 'selectors/rhs';

import AdvancedTextEditor from 'components/advanced_text_editor/advanced_text_editor';
import ChannelInviteModal from 'components/channel_invite_modal';
import ChannelMembersModal from 'components/channel_members_modal';
import {openPricingModal} from 'components/global_header/right_controls/plan_upgrade_button';
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
    StyledComponents: typeof import('styled-components');
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
    openPricingModal: () => typeof openPricingModal;
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
window.StyledComponents = require('styled-components');

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

// This need to be a function because `openPricingModal`
// is initialized when `UpgradeCloudButton` is loaded.
// So if we export `openPricingModal` directly, it will be locked
// to the initial value of undefined.
window.openPricingModal = () => openPricingModal;

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
