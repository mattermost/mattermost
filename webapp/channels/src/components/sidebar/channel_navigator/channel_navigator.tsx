// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import QuickSwitchModal from 'components/quick_switch_modal';

import Constants, {ModalIdentifiers} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import * as UserAgent from 'utils/user_agent';
import * as Utils from 'utils/utils';

import type {ModalData} from 'types/actions';

import ChannelFilter from '../channel_filter';

export type Props = WrappedComponentProps & {
    showUnreadsCategory: boolean;
    isQuickSwitcherOpen: boolean;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        closeModal: (modalId: string) => void;
    };
};

class ChannelNavigator extends React.PureComponent<Props> {
    componentDidMount() {
        document.addEventListener('keydown', this.handleShortcut);
        document.addEventListener('keydown', this.handleQuickSwitchKeyPress);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleShortcut);
        document.removeEventListener('keydown', this.handleQuickSwitchKeyPress);
    }

    openQuickSwitcher = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();

        trackEvent('ui', 'ui_sidebar_open_channel_switcher_v2');

        this.props.actions.openModal({
            modalId: ModalIdentifiers.QUICK_SWITCH,
            dialogType: QuickSwitchModal,
            dialogProps: {focusOriginElement: 'SidebarChannelNavigatorButton'},
        });
    };

    handleShortcut = (e: KeyboardEvent) => {
        const {actions: {closeModal}} = this.props;

        if (Keyboard.cmdOrCtrlPressed(e) && e.shiftKey) {
            if (Keyboard.isKeyPressed(e, Constants.KeyCodes.M)) {
                e.preventDefault();
                closeModal(ModalIdentifiers.QUICK_SWITCH);
            }
            if (Keyboard.isKeyPressed(e, Constants.KeyCodes.L)) {
                // just close the modal if it's open, but let someone else handle the shortcut
                closeModal(ModalIdentifiers.QUICK_SWITCH);
            }
        }
    };

    handleQuickSwitchKeyPress = (e: KeyboardEvent) => {
        if (Keyboard.cmdOrCtrlPressed(e) && !e.shiftKey && Keyboard.isKeyPressed(e, Constants.KeyCodes.K)) {
            if (!e.altKey && !Utils.isTextSelectedInPostOrReply(e)) {
                e.preventDefault();
                this.toggleQuickSwitchModal();
            }
        }
    };

    toggleQuickSwitchModal = () => {
        const {isQuickSwitcherOpen, actions: {openModal, closeModal}} = this.props;

        if (isQuickSwitcherOpen) {
            closeModal(ModalIdentifiers.QUICK_SWITCH);
        } else {
            openModal({
                modalId: ModalIdentifiers.QUICK_SWITCH,
                dialogType: QuickSwitchModal,
                dialogProps: {focusOriginElement: 'SidebarChannelNavigatorButton'},
            });
        }
    };

    render() {
        return (
            <div className={'SidebarChannelNavigator webapp'}>
                {!this.props.showUnreadsCategory && <ChannelFilter/>}
                <button
                    className={'SidebarChannelNavigator_jumpToButton'}
                    onClick={this.openQuickSwitcher}
                    aria-label={this.props.intl.formatMessage({id: 'sidebar_left.channel_navigator.channelSwitcherLabel', defaultMessage: 'Channel Switcher'})}
                    aria-haspopup='dialog'
                    data-testid='SidebarChannelNavigatorButton'
                    id='SidebarChannelNavigatorButton'
                >
                    <i className='icon icon-magnify'/>
                    <FormattedMessage
                        id='sidebar_left.channel_navigator.jumpTo'
                        defaultMessage='Find channel'
                    />
                    <div className={'SidebarChannelNavigator_shortcutText'}>
                        {`${UserAgent.isMac() ? '⌘' : 'Ctrl+'}K`}
                    </div>
                </button>
            </div>
        );
    }
}

export default injectIntl(ChannelNavigator);
