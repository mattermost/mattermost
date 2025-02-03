// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import IconButton from '@mattermost/compass-components/components/icon-button'; // eslint-disable-line no-restricted-imports

import {trackEvent} from 'actions/telemetry_actions';

import KeyboardShortcutsModal from 'components/keyboard_shortcuts/keyboard_shortcuts_modal/keyboard_shortcuts_modal';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';

import type {PropsFromRedux} from './index';

const mattermostUserGuideLink = 'https://docs.mattermost.com/guides/use-mattermost.html';
const trainingResourcesLink = 'https://academy.mattermost.com/';
const askTheCommunityUrl = 'https://mattermost.com/pl/default-ask-mattermost-community/';

type Props = WrappedComponentProps & PropsFromRedux & {
    location: {
        pathname: string;
    };
}

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
        const {
            intl,
            pluginMenuItems,
        } = this.props;

        const pluginItems = pluginMenuItems?.map((item) => {
            return (
                <Menu.ItemAction
                    id={item.id + '_pluginmenuitem'}
                    iconClassName='icon-thumbs-up-down'
                    key={item.id + '_pluginmenuitem'}
                    onClick={item.action}
                    text={item.text}
                />
            );
        });

        return (
            <Menu.Group>
                <Menu.ItemExternalLink
                    id='mattermostUserGuideLink'
                    iconClassName='icon-file-text-outline'
                    url={mattermostUserGuideLink}
                    text={intl.formatMessage({id: 'userGuideHelp.mattermostUserGuide', defaultMessage: 'Mattermost user guide'})}
                />
                {this.props.helpLink && (
                    <Menu.ItemExternalLink
                        id='trainingResourcesLink'
                        iconClassName='icon-lightbulb-outline'
                        url={trainingResourcesLink}
                        text={intl.formatMessage({id: 'userGuideHelp.trainingResources', defaultMessage: 'Training resources'})}
                    />
                )}
                {this.props.enableAskCommunityLink === 'true' && (
                    <Menu.ItemExternalLink
                        id='askTheCommunityLink'
                        iconClassName='icon-help'
                        url={askTheCommunityUrl}
                        text={intl.formatMessage({id: 'userGuideHelp.askTheCommunity', defaultMessage: 'Ask the community'})}
                        onClick={this.askTheCommunityClick}
                    />
                )}
                {this.props.reportAProblemLink && (
                    <Menu.ItemExternalLink
                        id='reportAProblemLink'
                        iconClassName='icon-alert-outline'
                        url={this.props.reportAProblemLink}
                        text={intl.formatMessage({id: 'userGuideHelp.reportAProblem', defaultMessage: 'Report a problem'})}
                    />
                )}
                <Menu.ItemAction
                    id='keyboardShortcuts'
                    iconClassName='icon-keyboard-return'
                    onClick={this.openKeyboardShortcutsModal}
                    text={intl.formatMessage({id: 'userGuideHelp.keyboardShortcuts', defaultMessage: 'Keyboard shortcuts'})}
                />
                {pluginItems}
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
                id='helpMenuPortal'
                className='userGuideHelp'
                onToggle={this.buttonToggleState}
            >
                <WithTooltip
                    title={tooltipText}
                >
                    <IconButton
                        size={'sm'}
                        icon={'help-circle-outline'}
                        onClick={() => {}} // icon button currently requires onclick ... needs to revisit
                        active={this.state.buttonActive}
                        inverted={true}
                        compact={true}
                        aria-controls='AddChannelDropdown'
                        aria-expanded={this.state.buttonActive}
                        aria-label={intl.formatMessage({id: 'channel_header.userHelpGuide', defaultMessage: 'Help'})}
                    />
                </WithTooltip>
                <Menu
                    openLeft={false}
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
