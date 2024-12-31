// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import KeyboardShortcutsModal from 'components/keyboard_shortcuts/keyboard_shortcuts_modal/keyboard_shortcuts_modal';
import UserGuideIcon from 'components/widgets/icons/user_guide_icon';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';

import type {PropsFromRedux} from './index';

const askTheCommunityUrl = 'https://mattermost.com/pl/default-ask-mattermost-community/';

type Props = PropsFromRedux & WrappedComponentProps

type State = {
    buttonActive: boolean;
};

class UserGuideDropdown extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            buttonActive: false,
        };
    }

    openKeyboardShortcutsModal = (e: MouseEvent) => {
        e.preventDefault();
        this.props.actions.openModal({
            modalId: ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL,
            dialogType: KeyboardShortcutsModal,
        });
    };

    buttonToggleState = (menuActive: boolean) => {
        this.setState({
            buttonActive: menuActive,
        });
    };

    askTheCommunityClick = () => {
        trackEvent('ui', 'help_ask_the_community');
    };

    renderDropdownItems = (): React.ReactNode => {
        const {intl} = this.props;

        return (
            <Menu.Group>
                {this.props.enableAskCommunityLink === 'true' && (
                    <Menu.ItemExternalLink
                        id='askTheCommunityLink'
                        url={askTheCommunityUrl}
                        text={intl.formatMessage({id: 'userGuideHelp.askTheCommunity', defaultMessage: 'Ask the community'})}
                        onClick={this.askTheCommunityClick}
                    />
                )}
                <Menu.ItemExternalLink
                    id='helpResourcesLink'
                    url={this.props.helpLink}
                    text={intl.formatMessage({id: 'userGuideHelp.helpResources', defaultMessage: 'Help resources'})}
                />
                <Menu.ItemExternalLink
                    id='reportAProblemLink'
                    url={this.props.reportAProblemLink}
                    text={intl.formatMessage({id: 'userGuideHelp.reportAProblem', defaultMessage: 'Report a problem'})}
                />
                <Menu.ItemAction
                    id='keyboardShortcuts'
                    onClick={this.openKeyboardShortcutsModal}
                    text={intl.formatMessage({id: 'userGuideHelp.keyboardShortcuts', defaultMessage: 'Keyboard shortcuts'})}
                />
            </Menu.Group>
        );
    };

    render() {
        const {intl} = this.props;
        const tooltipText = (
            <FormattedMessage
                id={'channel_header.userHelpGuide'}
                defaultMessage='Help'
            />
        );

        return (
            <MenuWrapper
                className='userGuideHelp'
                onToggle={this.buttonToggleState}
            >
                <WithTooltip
                    title={this.state.buttonActive ? '' : tooltipText}
                >
                    <button
                        id='channelHeaderUserGuideButton'
                        className={classNames('channel-header__icon', {'channel-header__icon--active': this.state.buttonActive})}
                        type='button'
                        aria-expanded='true'
                    >
                        <UserGuideIcon className='icon'/>
                    </button>
                </WithTooltip>
                <Menu
                    openLeft={true}
                    openUp={false}
                    id='AddChannelDropdown'
                    ariaLabel={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.dropdownAriaLabel', defaultMessage: 'Add Channel Dropdown'})}
                >
                    {this.renderDropdownItems()}
                </Menu>
            </MenuWrapper>
        );
    }
}

export default injectIntl(UserGuideDropdown);
