// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';

import ModalStore from 'stores/modal_store.jsx';

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import {Modal} from 'react-bootstrap';
import React from 'react';
import PropTypes from 'prop-types';

const allShortcuts = defineMessages({
    mainHeader: {
        default: {
            id: 'shortcuts.header',
            defaultMessage: 'Keyboard Shortcuts\tCtrl|/'
        },
        mac: {
            id: 'shortcuts.header.mac',
            defaultMessage: 'Keyboard Shortcuts\t⌘|/'
        }
    },
    navHeader: {
        id: 'shortcuts.nav.header',
        defaultMessage: 'Navigation'
    },
    navPrev: {
        default: {
            id: 'shortcuts.nav.prev',
            defaultMessage: 'Previous channel:\tAlt|Up'
        },
        mac: {
            id: 'shortcuts.nav.prev.mac',
            defaultMessage: 'Previous channel:\t⌥|Up'
        }
    },
    navNext: {
        default: {
            id: 'shortcuts.nav.next',
            defaultMessage: 'Next channel:\tAlt|Down'
        },
        mac: {
            id: 'shortcuts.nav.next.mac',
            defaultMessage: 'Next channel:\t⌥|Down'
        }
    },
    navUnreadPrev: {
        default: {
            id: 'shortcuts.nav.unread_prev',
            defaultMessage: 'Previous unread channel:\tAlt|Shift|Up'
        },
        mac: {
            id: 'shortcuts.nav.unread_prev.mac',
            defaultMessage: 'Previous unread channel:\t⌥|Shift|Up'
        }
    },
    navUnreadNext: {
        default: {
            id: 'shortcuts.nav.unread_next',
            defaultMessage: 'Next unread channel:\tAlt|Shift|Down'
        },
        mac: {
            id: 'shortcuts.nav.unread_next.mac',
            defaultMessage: 'Next unread channel:\t⌥|Shift|Down'
        }
    },
    navSwitcher: {
        default: {
            id: 'shortcuts.nav.switcher',
            defaultMessage: 'Quick channel switcher:\tCtrl|K'
        },
        mac: {
            id: 'shortcuts.nav.switcher.mac',
            defaultMessage: 'Quick channel switcher:\t⌘|K'
        }
    },
    navDMMenu: {
        default: {
            id: 'shortcuts.nav.direct_messages_menu',
            defaultMessage: 'Direct messages menu:\tCtrl|Shift|K'
        },
        mac: {
            id: 'shortcuts.nav.direct_messages_menu.mac',
            defaultMessage: 'Direct messages menu:\t⌘|Shift|K'
        }
    },
    navSettings: {
        default: {
            id: 'shortcuts.nav.settings',
            defaultMessage: 'Account settings:\tCtrl|Shift|A'
        },
        mac: {
            id: 'shortcuts.nav.settings.mac',
            defaultMessage: 'Account settings:\t⌘|Shift|A'
        }
    },
    navMentions: {
        default: {
            id: 'shortcuts.nav.mentions',
            defaultMessage: 'Recent mentions:\tCtrl|Shift|M'
        },
        mac: {
            id: 'shortcuts.nav.mentions.mac',
            defaultMessage: 'Recent mentions:\t⌘|Shift|M'
        }
    },
    msgHeader: {
        id: 'shortcuts.msgs.header',
        defaultMessage: 'Messages'
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
        default: {
            id: 'shortcuts.msgs.reprint_prev',
            defaultMessage: 'Reprint previous message:\tCtrl|Up'
        },
        mac: {
            id: 'shortcuts.msgs.reprint_prev.mac',
            defaultMessage: 'Reprint previous message:\t⌘|Up'
        }
    },
    msgReprintNext: {
        default: {
            id: 'shortcuts.msgs.reprint_next',
            defaultMessage: 'Reprint next message:\tCtrl|Down'
        },
        mac: {
            id: 'shortcuts.msgs.reprint_next.mac',
            defaultMessage: 'Reprint next message:\t⌘|Down'
        }
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
        default: {
            id: 'shortcuts.files.upload',
            defaultMessage: 'Upload files:\tCtrl|U'
        },
        mac: {
            id: 'shortcuts.files.upload.mac',
            defaultMessage: 'Upload files:\t⌘|U'
        }
    },
    browserHeader: {
        id: 'shortcuts.browser.header',
        defaultMessage: 'Built-in Browser Commands'
    },
    browserChannelPrev: {
        default: {
            id: 'shortcuts.browser.channel_prev',
            defaultMessage: 'Back in history:\tAlt|Left'
        },
        mac: {
            id: 'shortcuts.browser.channel_prev.mac',
            defaultMessage: 'Back in history:\t⌘|['
        }
    },
    browserChannelNext: {
        default: {
            id: 'shortcuts.browser.channel_next',
            defaultMessage: 'Forward in history:\tAlt|Right'
        },
        mac: {
            id: 'shortcuts.browser.channel_next.mac',
            defaultMessage: 'Forward in history:\t⌘|]'
        }
    },
    browserFontIncrease: {
        default: {
            id: 'shortcuts.browser.font_increase',
            defaultMessage: 'Zoom in:\tCtrl|+'
        },
        mac: {
            id: 'shortcuts.browser.font_increase.mac',
            defaultMessage: 'Zoom in:\t⌘|+'
        }
    },
    browserFontDecrease: {
        default: {
            id: 'shortcuts.browser.font_decrease',
            defaultMessage: 'Zoom out:\tCtrl|-'
        },
        mac: {
            id: 'shortcuts.browser.font_decrease.mac',
            defaultMessage: 'Zoom out:\t⌘|-'
        }
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
        intl: intlShape.isRequired,
        isMac: PropTypes.bool.isRequired
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

    getShortcuts() {
        const {isMac} = this.props;
        const shortcuts = {};
        Object.keys(allShortcuts).forEach((s) => {
            if (isMac && allShortcuts[s].mac) {
                shortcuts[s] = allShortcuts[s].mac;
            } else if (!isMac && allShortcuts[s].default) {
                shortcuts[s] = allShortcuts[s].default;
            } else {
                shortcuts[s] = allShortcuts[s];
            }
        });

        return shortcuts;
    }

    render() {
        const shortcuts = this.getShortcuts();
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
                            <strong>{renderShortcut(formatMessage(shortcuts.mainHeader))}</strong>
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body ref='modalBody'>
                        <div className='row'>
                            <div className='col-sm-4'>
                                <div className='section'>
                                    <div>
                                        <h4 className='section-title'><strong>{formatMessage(shortcuts.navHeader)}</strong></h4>
                                        {renderShortcut(formatMessage(shortcuts.navPrev))}
                                        {renderShortcut(formatMessage(shortcuts.navNext))}
                                        {renderShortcut(formatMessage(shortcuts.navUnreadPrev))}
                                        {renderShortcut(formatMessage(shortcuts.navUnreadNext))}
                                        {renderShortcut(formatMessage(shortcuts.navSwitcher))}
                                        {renderShortcut(formatMessage(shortcuts.navDMMenu))}
                                        {renderShortcut(formatMessage(shortcuts.navSettings))}
                                        {renderShortcut(formatMessage(shortcuts.navMentions))}
                                    </div>
                                </div>
                            </div>
                            <div className='col-sm-4'>
                                <div className='section'>
                                    <div>
                                        <h4 className='section-title'><strong>{formatMessage(shortcuts.msgHeader)}</strong></h4>
                                        <span><strong>{formatMessage(shortcuts.msgInputHeader)}</strong></span>
                                        <div className='subsection'>
                                            {renderShortcut(formatMessage(shortcuts.msgEdit))}
                                            {renderShortcut(formatMessage(shortcuts.msgReply))}
                                            {renderShortcut(formatMessage(shortcuts.msgReprintPrev))}
                                            {renderShortcut(formatMessage(shortcuts.msgReprintNext))}
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
                                        {renderShortcut(formatMessage(shortcuts.filesUpload))}
                                    </div>
                                    <div className='section--lower'>
                                        <h4 className='section-title'><strong>{formatMessage(shortcuts.browserHeader)}</strong></h4>
                                        {renderShortcut(formatMessage(shortcuts.browserChannelPrev))}
                                        {renderShortcut(formatMessage(shortcuts.browserChannelNext))}
                                        {renderShortcut(formatMessage(shortcuts.browserFontIncrease))}
                                        {renderShortcut(formatMessage(shortcuts.browserFontDecrease))}
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

    let keys = null;
    if (shortcut.length > 1) {
        keys = shortcut[1].split('|').map((key) => (
            <span
                className='shortcut-key'
                key={key}
            >
                {key}
            </span>
        ));
    }

    return (
        <div className='shortcut-line'>
            {description}
            {keys}
        </div>
    );
}

export default injectIntl(ShortcutsModal);
