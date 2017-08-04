// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import ModalStore from 'stores/modal_store.jsx';

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import {Modal} from 'react-bootstrap';
import React from 'react';

const shortcuts = defineMessages({
    mainHeader: {
        id: 'shortcuts.header',
        defaultMessage: 'Keyboard Shortcuts'
    },
    navHeader: {
        id: 'shortcuts.nav.header',
        defaultMessage: 'Navigation'
    },
    navPrev: {
        id: 'shortcuts.nav.prev',
        defaultMessage: 'Previous channel:\tAlt|Up'
    },
    navPrevMac: {
        id: 'shortcuts.nav.prev.mac',
        defaultMessage: 'Previous channel:\t⌥|Up'
    },
    navNext: {
        id: 'shortcuts.nav.next',
        defaultMessage: 'Next channel:\tAlt|Down'
    },
    navNextMac: {
        id: 'shortcuts.nav.next.mac',
        defaultMessage: 'Next channel:\t⌥|Down'
    },
    navUnreadPrev: {
        id: 'shortcuts.nav.unread_prev',
        defaultMessage: 'Previous unread channel:\tAlt|Shift|Up'
    },
    navUnreadPrevMac: {
        id: 'shortcuts.nav.unread_prev.mac',
        defaultMessage: 'Previous unread channel:\t⌥|Shift|Up'
    },
    navUnreadNext: {
        id: 'shortcuts.nav.unread_next',
        defaultMessage: 'Next unread channel:\tAlt|Shift|Down'
    },
    navUnreadNextMac: {
        id: 'shortcuts.nav.unread_next.mac',
        defaultMessage: 'Next unread channel:\t⌥|Shift|Down'
    },
    navSwitcher: {
        id: 'shortcuts.nav.switcher',
        defaultMessage: 'Quick channel switcher:\tCtrl|K'
    },
    navSwitcherMac: {
        id: 'shortcuts.nav.switcher.mac',
        defaultMessage: 'Quick channel switcher:\t⌘|K'
    },
    navSwitcherTeam: {
        id: 'shortcuts.nav.switcher_team',
        defaultMessage: 'Quick team switcher:\tCtrl|Alt|K'
    },
    navSwitcherTeamMac: {
        id: 'shortcuts.nav.switcher_team.mac',
        defaultMessage: 'Quick team switcher:\t⌘|⌥|K'
    },
    navDMMenu: {
        id: 'shortcuts.nav.direct_messages_menu',
        defaultMessage: 'Direct messages menu:\tCtrl|Shift|K'
    },
    navDMMenuMac: {
        id: 'shortcuts.nav.direct_messages_menu.mac',
        defaultMessage: 'Direct messages menu:\t⌘|Shift|K'
    },
    navSettings: {
        id: 'shortcuts.nav.settings',
        defaultMessage: 'Account settings:\tCtrl|Shift|A'
    },
    navSettingsMac: {
        id: 'shortcuts.nav.settings.mac',
        defaultMessage: 'Account settings:\t⌘|Shift|A'
    },
    navMentions: {
        id: 'shortcuts.nav.mentions',
        defaultMessage: 'Recent mentions:\tCtrl|Shift|M'
    },
    navMentionsMac: {
        id: 'shortcuts.nav.mentions.mac',
        defaultMessage: 'Recent mentions:\t⌘|Shift|M'
    },
    msgHeader: {
        id: 'shortcuts.msgs.header',
        defaultMessage: 'Messages'
    },
    msgMarkAsRead: {
        id: 'shortcuts.msgs.mark_as_read',
        defaultMessage: 'Mark current channel as read:\tEsc'
    },
    msgInputHeader: {
        id: 'shortcuts.msgs.input.header',
        defaultMessage: 'Works inside an empty input field'
    },
    msgEdit: {
        id: 'shortcuts.msgs.edit',
        defaultMessage: 'Edit last message in channel:\tUp'
    },
    msgReply: {
        id: 'shortcuts.msgs.reply',
        defaultMessage: 'Reply to last message in channel:\tShift|Up'
    },
    msgReprintPrev: {
        id: 'shortcuts.msgs.reprint_prev',
        defaultMessage: 'Reprint previous message:\tCtrl|Up'
    },
    msgReprintPrevMac: {
        id: 'shortcuts.msgs.reprint_prev.mac',
        defaultMessage: 'Reprint previous message:\t⌘|Up'
    },
    msgReprintNext: {
        id: 'shortcuts.msgs.reprint_next',
        defaultMessage: 'Reprint next message:\tCtrl|Down'
    },
    msgReprintNextMac: {
        id: 'shortcuts.msgs.reprint_next.mac',
        defaultMessage: 'Reprint next message:\t⌘|Down'
    },
    msgCompHeader: {
        id: 'shortcuts.msgs.comp.header',
        defaultMessage: 'Autocomplete'
    },
    msgCompUsername: {
        id: 'shortcuts.msgs.comp.username',
        defaultMessage: 'Username:\t@|[a-z]|Tab'
    },
    msgCompChannel: {
        id: 'shortcuts.msgs.comp.channel',
        defaultMessage: 'Channel:\t~|[a-z]|Tab'
    },
    msgCompEmoji: {
        id: 'shortcuts.msgs.comp.emoji',
        defaultMessage: 'Emoji:\t:|[a-z]|Tab'
    },
    filesHeader: {
        id: 'shortcuts.files.header',
        defaultMessage: 'Files'
    },
    filesUpload: {
        id: 'shortcuts.files.upload',
        defaultMessage: 'Upload files:\tCtrl|U'
    },
    filesUploadMac: {
        id: 'shortcuts.files.upload.mac',
        defaultMessage: 'Upload files:\t⌘|U'
    },
    browserHeader: {
        id: 'shortcuts.browser.header',
        defaultMessage: 'Built-in Browser Commands'
    },
    browserChannelPrev: {
        id: 'shortcuts.browser.channel_prev',
        defaultMessage: 'Back in history:\tAlt|Left'
    },
    browserChannelPrevMac: {
        id: 'shortcuts.browser.channel_prev.mac',
        defaultMessage: 'Back in history:\t⌘|['
    },
    browserChannelNext: {
        id: 'shortcuts.browser.channel_next',
        defaultMessage: 'Forward in history:\tAlt|Right'
    },
    browserChannelNextMac: {
        id: 'shortcuts.browser.channel_next.mac',
        defaultMessage: 'Forward in history:\t⌘|]'
    },
    browserFontIncrease: {
        id: 'shortcuts.browser.font_increase',
        defaultMessage: 'Zoom in:\tCtrl|+'
    },
    browserFontIncreaseMac: {
        id: 'shortcuts.browser.font_increase.mac',
        defaultMessage: 'Zoom in:\t⌘|+'
    },

    browserFontDecrease: {
        id: 'shortcuts.browser.font_decrease',
        defaultMessage: 'Zoom out:\tCtrl|-'
    },
    browserFontDecreaseMac: {
        id: 'shortcuts.browser.font_decrease.mac',
        defaultMessage: 'Zoom out:\t⌘|-'
    },
    browserInputHeader: {
        id: 'shortcuts.browser.input.header',
        defaultMessage: 'Works inside an input field'
    },
    browserHighlightPrev: {
        id: 'shortcuts.browser.highlight_prev',
        defaultMessage: 'Highlight text to the previous line:\tShift|Up'
    },
    browserHighlightNext: {
        id: 'shortcuts.browser.highlight_next',
        defaultMessage: 'Highlight text to the next line:\tShift|Down'
    },
    browserNewline: {
        id: 'shortcuts.browser.newline',
        defaultMessage: 'Create a new line:\tShift|Enter'
    },
    info: {
        id: 'shortcuts.info',
        defaultMessage: 'Begin a message with / for a list of all the commands at your disposal.'
    }
});

class ShortcutsModal extends React.PureComponent {
    static propTypes = {
        intl: intlShape.isRequired
    }

    constructor(props) {
        super(props);

        this.state = {
            show: false
        };
    }

    componentDidMount() {
        ModalStore.addModalListener(Constants.ActionTypes.TOGGLE_SHORTCUTS_MODAL, this.handleToggle);
    }

    componentWillUnmount() {
        ModalStore.removeModalListener(Constants.ActionTypes.TOGGLE_SHORTCUTS_MODAL, this.handleToggle);
    }

    handleToggle = (value) => {
        this.setState({
            show: value
        });
    }

    handleHide = () => {
        this.setState({show: false});
    }

    render() {
        let navPrev = shortcuts.navPrev;
        let navNext = shortcuts.navNext;
        let navUnreadPrev = shortcuts.navUnreadPrev;
        let navUnreadNext = shortcuts.navUnreadNext;
        let navSwitcher = shortcuts.navSwitcher;
        let navSwitcherTeam = shortcuts.navSwitcherTeam;
        let navDMMenu = shortcuts.navDMMenu;
        let navSettings = shortcuts.navSettings;
        let navMentions = shortcuts.navMentions;
        let msgReprintPrev = shortcuts.msgReprintPrev;
        let msgReprintNext = shortcuts.msgReprintNext;
        let filesUpload = shortcuts.filesUpload;
        let browserChannelPrev = shortcuts.browserChannelPrev;
        let browserChannelNext = shortcuts.browserChannelNext;
        let browserFontIncrease = shortcuts.browserFontIncrease;
        let browserFontDecrease = shortcuts.browserFontDecrease;
        if (Utils.isMac()) {
            navPrev = shortcuts.navPrevMac;
            navNext = shortcuts.navNextMac;
            navUnreadPrev = shortcuts.navUnreadPrevMac;
            navUnreadNext = shortcuts.navUnreadNextMac;
            navSwitcher = shortcuts.navSwitcherMac;
            navSwitcherTeam = shortcuts.navSwitcherTeamMac;
            navDMMenu = shortcuts.navDMMenuMac;
            navSettings = shortcuts.navSettingsMac;
            navMentions = shortcuts.navMentionsMac;
            msgReprintPrev = shortcuts.msgReprintPrevMac;
            msgReprintNext = shortcuts.msgReprintNextMac;
            filesUpload = shortcuts.filesUploadMac;
            browserChannelPrev = shortcuts.browserChannelPrevMac;
            browserChannelNext = shortcuts.browserChannelNextMac;
            browserFontIncrease = shortcuts.browserFontIncreaseMac;
            browserFontDecrease = shortcuts.browserFontDecreaseMac;
        }

        const {formatMessage} = this.props.intl;

        return (
            <Modal
                dialogClassName='shortcuts-modal'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleHide}
            >
                <div className='shortcuts-content'>
                    <Modal.Header closeButton={true}>
                        <Modal.Title>
                            <strong>{formatMessage(shortcuts.mainHeader)}</strong>
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body ref='modalBody'>
                        <div className='row'>
                            <div className='col-sm-4'>
                                <div className='section'>
                                    <div>
                                        <h4 className='section-title'><strong>{formatMessage(shortcuts.navHeader)}</strong></h4>
                                        {renderShortcut(formatMessage(navPrev))}
                                        {renderShortcut(formatMessage(navNext))}
                                        {renderShortcut(formatMessage(navUnreadPrev))}
                                        {renderShortcut(formatMessage(navUnreadNext))}
                                        {renderShortcut(formatMessage(navSwitcher))}
                                        {renderShortcut(formatMessage(navSwitcherTeam))}
                                        {renderShortcut(formatMessage(navDMMenu))}
                                        {renderShortcut(formatMessage(navSettings))}
                                        {renderShortcut(formatMessage(navMentions))}
                                    </div>
                                </div>
                            </div>
                            <div className='col-sm-4'>
                                <div className='section'>
                                    <div>
                                        <h4 className='section-title'><strong>{formatMessage(shortcuts.msgHeader)}</strong></h4>
                                        {renderShortcut(formatMessage(shortcuts.msgMarkAsRead))}
                                        <span><strong>{formatMessage(shortcuts.msgInputHeader)}</strong></span>
                                        <div className='subsection'>
                                            {renderShortcut(formatMessage(shortcuts.msgEdit))}
                                            {renderShortcut(formatMessage(shortcuts.msgReply))}
                                            {renderShortcut(formatMessage(msgReprintPrev))}
                                            {renderShortcut(formatMessage(msgReprintNext))}
                                        </div>
                                        <span><strong>{formatMessage(shortcuts.msgCompHeader)}</strong></span>
                                        <div className='subsection'>
                                            {renderShortcut(formatMessage(shortcuts.msgCompUsername))}
                                            {renderShortcut(formatMessage(shortcuts.msgCompChannel))}
                                            {renderShortcut(formatMessage(shortcuts.msgCompEmoji))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className='col-sm-4'>
                                <div className='section'>
                                    <div>
                                        <h4 className='section-title'><strong>{formatMessage(shortcuts.filesHeader)}</strong></h4>
                                        {renderShortcut(formatMessage(filesUpload))}
                                    </div>
                                    <div className='seciton--lower'>
                                        <h4 className='section-title'><strong>{formatMessage(shortcuts.browserHeader)}</strong></h4>
                                        {renderShortcut(formatMessage(browserChannelPrev))}
                                        {renderShortcut(formatMessage(browserChannelNext))}
                                        {renderShortcut(formatMessage(browserFontIncrease))}
                                        {renderShortcut(formatMessage(browserFontDecrease))}
                                        <span><strong>{formatMessage(shortcuts.browserInputHeader)}</strong></span>
                                        <div className='subsection'>
                                            {renderShortcut(formatMessage(shortcuts.browserHighlightPrev))}
                                            {renderShortcut(formatMessage(shortcuts.browserHighlightNext))}
                                            {renderShortcut(formatMessage(shortcuts.browserNewline))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className='info__label'>{formatMessage(shortcuts.info)}</div>
                    </Modal.Body>
                </div>
            </Modal>
        );
    }
}

function renderShortcut(text) {
    if (!text) {
        return null;
    }

    const shortcut = text.split('\t');
    const description = <span>{shortcut[0]}</span>;
    const keys = shortcut[1].split('|').map((key) =>
        <span
            className='shortcut-key'
            key={key}
        >
            {key}
        </span>
    );

    return (
        <div className='shortcut-line'>
            {description}
            {keys}
        </div>
    );
}

export default injectIntl(ShortcutsModal);
