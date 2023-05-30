// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {defineMessages, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {GlobalState} from 'types/store';

import {suitePluginIds} from 'utils/constants';
import * as UserAgent from 'utils/user_agent';

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
    KeyboardShortcutDescriptor,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

import './keyboard_shortcuts_modal.scss';

const modalMessages = defineMessages({
    msgHeader: {
        id: 'shortcuts.msgs.header',
        defaultMessage: 'Messages',
    },
    msgInputHeader: {
        id: 'shortcuts.msgs.input.header',
        defaultMessage: 'Works inside an empty input field',
    },
    filesHeader: {
        id: 'shortcuts.files.header',
        defaultMessage: 'Files',
    },
    browserHeader: {
        id: 'shortcuts.browser.header',
        defaultMessage: 'Built-in Browser Commands',
    },
    msgCompHeader: {
        id: 'shortcuts.msgs.comp.header',
        defaultMessage: 'Autocomplete',
    },
    browserInputHeader: {
        id: 'shortcuts.browser.input.header',
        defaultMessage: 'Works inside an input field',
    },
    msgMarkdownHeader: {
        id: 'shortcuts.msgs.markdown.header',
        defaultMessage: 'Formatting',
    },
    info: {
        id: 'shortcuts.info',
        defaultMessage:
            'Begin a message with / for a list of all the available slash commands.',
    },
    navHeader: {
        id: 'shortcuts.nav.header',
        defaultMessage: 'Navigation',
    },
    msgSearchHeader: {
        id: 'shortcuts.msgs.search.header',
        defaultMessage: 'Searching',
    },
    callsHeader: {
        id: 'shortcuts.calls.header',
        defaultMessage: 'Calls',
    },
    callsGlobalHeader: {
        id: 'shortcuts.calls.global.header',
        defaultMessage: 'Global',
    },
    callsWidgetHeader: {
        id: 'shortcuts.calls.widget.header',
        defaultMessage: 'Call widget',
    },
    callsExpandedHeader: {
        id: 'shortcuts.calls.expanded.header',
        defaultMessage: 'Expanded view (pop-out window)',
    },
});

interface Props {
    onExited: () => void;
}

const KeyboardShortcutsModal = ({onExited}: Props): JSX.Element => {
    const [show, setShow] = useState(true);

    const {formatMessage} = useIntl();

    const handleHide = useCallback(() => setShow(false), []);

    const isLinux = UserAgent.isLinux();

    const isCallsEnabled = useSelector((state: GlobalState) => {
        return Boolean(state.plugins.plugins[suitePluginIds.calls]);
    });

    const renderShortcutSequences = (shortcuts: {[key: string]: KeyboardShortcutDescriptor}) => {
        return Object.entries(shortcuts).map(([key, shortcut]) => {
            return (
                <KeyboardShortcutSequence
                    key={key}
                    shortcut={shortcut}
                />
            );
        });
    };

    return (
        <Modal
            dialogClassName='a11y__modal shortcuts-modal'
            show={show}
            onHide={handleHide}
            onExited={onExited}
            role='dialog'
            aria-labelledby='shortcutsModalLabel'
        >
            <div className='shortcuts-content'>
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='shortcutsModalLabel'
                    >
                        <strong><KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.mainHeader}/></strong>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='row'>
                        <div className='col-sm-4'>
                            <div className='section'>
                                <div>
                                    <h3 className='section-title'><strong>{formatMessage(modalMessages.navHeader)}</strong></h3>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navPrev}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navNext}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navUnreadPrev}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navUnreadNext}/>
                                    {!isLinux && <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.teamNavPrev}/>}
                                    {!isLinux && <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.teamNavNext}/>}
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.teamNavSwitcher}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navSwitcher}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navDMMenu}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navSettings}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navMentions}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navFocusCenter}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navOpenCloseSidebar}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navExpandSidebar}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navOpenChannelInfo}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.navToggleUnreads}/>
                                </div>
                            </div>
                        </div>
                        <div className='col-sm-4'>
                            <div className='section'>
                                <div>
                                    <h3 className='section-title'><strong>{formatMessage(modalMessages.msgHeader)}</strong></h3>
                                    <span><strong>{formatMessage(modalMessages.msgInputHeader)}</strong></span>
                                    <div className='subsection'>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgEdit}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgReply}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgLastReaction}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgReprintPrev}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgReprintNext}/>
                                    </div>
                                    <span><strong>{formatMessage(modalMessages.msgCompHeader)}</strong></span>
                                    <div className='subsection'>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgCompUsername}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgCompChannel}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgCompEmoji}/>
                                    </div>
                                    <span><strong>{formatMessage(modalMessages.msgMarkdownHeader)}</strong></span>
                                    <div className='subsection'>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgMarkdownBold}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgMarkdownItalic}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgMarkdownLink}/>
                                    </div>
                                    <span><strong>{formatMessage(modalMessages.msgSearchHeader)}</strong></span>
                                    <div className='subsection'>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgSearchChannel}/>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className='col-sm-4'>
                            <div className='section'>
                                <div>
                                    <h3 className='section-title'><strong>{formatMessage(modalMessages.filesHeader)}</strong></h3>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.filesUpload}/>
                                </div>
                                <div className='section--lower'>
                                    <h3 className='section-title'><strong>{formatMessage(modalMessages.browserHeader)}</strong></h3>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserChannelPrev}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserChannelNext}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserFontIncrease}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserFontDecrease}/>
                                    <span><strong>{formatMessage(modalMessages.browserInputHeader)}</strong></span>
                                    <div className='subsection'>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserHighlightPrev}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserHighlightNext}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserNewline}/>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                    { isCallsEnabled &&
                    <div className='row'>
                        <div className='col-sm-4'>
                            <div className='section'>
                                <div>
                                    <h3 className='section-title'><strong>{formatMessage(modalMessages.callsHeader)}</strong></h3>

                                    <span><strong>{formatMessage(modalMessages.callsGlobalHeader)}</strong></span>
                                    <div className='subsection'>
                                        {renderShortcutSequences(KEYBOARD_SHORTCUTS.calls.global)}
                                    </div>

                                    <span><strong>{formatMessage(modalMessages.callsWidgetHeader)}</strong></span>
                                    <div className='subsection'>
                                        {renderShortcutSequences(KEYBOARD_SHORTCUTS.calls.widget)}
                                    </div>

                                    <span><strong>{formatMessage(modalMessages.callsExpandedHeader)}</strong></span>
                                    <div className='subsection'>
                                        {renderShortcutSequences(KEYBOARD_SHORTCUTS.calls.popout)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    }
                    <div className='info__label'>{formatMessage(modalMessages.info)}</div>
                </Modal.Body>
            </div>
        </Modal>
    );
};

export default KeyboardShortcutsModal;
