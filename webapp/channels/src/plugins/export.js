// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {notifyMe} from 'actions/notification_actions';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide, selectPostById} from 'actions/views/rhs';
import {getSelectedPostId, getIsRhsOpen} from 'selectors/rhs';

import ChannelInviteModal from 'components/channel_invite_modal';
import ChannelMembersModal from 'components/channel_members_modal';
import {openPricingModal} from 'components/global_header/right_controls/plan_upgrade_button';
import {useNotifyAdmin} from 'components/notify_admin_cta/notify_admin_cta';
import PurchaseModal from 'components/purchase_modal';
import StartTrialFormModal from 'components/start_trial_form_modal';
import Timestamp from 'components/timestamp';
import BotTag from 'components/widgets/tag/bot_tag';
import Avatar from 'components/widgets/users/avatar';

import {getHistory} from 'utils/browser_history';
import {ModalIdentifiers} from 'utils/constants';
import messageHtmlToComponent from 'utils/message_html_to_component';
import * as NotificationSounds from 'utils/notification_sounds';
import {formatText} from 'utils/text_formatting';
import {useWebSocket, useWebSocketClient, WebSocketContext} from 'utils/use_websocket';
import {imageURLForUser} from 'utils/utils';

import {openInteractiveDialog} from './interactive_dialog'; // This import has intentional side effects. Do not remove without research.
import Textbox from './textbox';

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
    messageHtmlToComponent: (html, ...otherArgs) => {
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
    modals: {openModal, ModalIdentifiers},
    notificationSounds: {ring: NotificationSounds.ring, stopRing: NotificationSounds.stopRing},
    sendDesktopNotificationToMe: notifyMe,
};
Object.defineProperty(window.WebappUtils, 'browserHistory', {
    get: () => getHistory(),
});

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
    PurchaseModal,
    Timestamp,
    ChannelInviteModal,
    ChannelMembersModal,
    Avatar,
    imageURLForUser,
    BotBadge: BotTag,
    StartTrialFormModal,
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
