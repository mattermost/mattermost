// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {defineMessages, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {isCallsEnabled} from 'selectors/calls';

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import type {
    KeyboardShortcutDescriptor} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

import * as UserAgent from 'utils/user_agent';

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
    const contentRef = useRef<HTMLDivElement>(null);

    const {formatMessage} = useIntl();

    const handleHide = useCallback(() => setShow(false), []);

    const isLinux = UserAgent.isLinux();

    const callsEnabled = useSelector(isCallsEnabled);

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

    useEffect(() => {
        contentRef.current?.focus();
    }, []);

    return (
        <Modal
            dialogClassName='a11y__modal shortcuts-modal'
            show={show}
            onHide={handleHide}
            onExited={onExited}
            role='none'
            aria-labelledby='shortcutsModalLabel'
        >
            <div className='shortcuts-content'>
                <Modal.Header
                    closeButton={true}
                    className='divider'
                >
                    <Modal.Title
                        componentClass='h1'
                        id='shortcutsModalLabel'
                    >
                        <strong><KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.mainHeader}/></strong>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body tabIndex={0}>
                    <div
                        tabIndex={-1}
                        ref={contentRef}
                    />
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
                                    <div className='subsection'>
                                        <h4 className='subsection-title'>{formatMessage(modalMessages.msgInputHeader)}</h4>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgEdit}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgReply}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgLastReaction}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgReprintPrev}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgReprintNext}/>
                                    </div>
                                    <div className='subsection'>
                                        <h4 className='subsection-title'>{formatMessage(modalMessages.msgCompHeader)}</h4>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgCompUsername}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgCompChannel}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgCompEmoji}/>
                                    </div>
                                    <div className='subsection'>
                                        <h4 className='subsection-title'>{formatMessage(modalMessages.msgMarkdownHeader)}</h4>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgMarkdownBold}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgMarkdownItalic}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgMarkdownLink}/>
                                    </div>
                                    <div className='subsection'>
                                        <h4 className='subsection-title'>{formatMessage(modalMessages.msgSearchHeader)}</h4>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.msgSearchChannel}/>
                                    </div>
                                    <div className='subsection'>
                                        <h4 className='subsection-title'>{formatMessage(modalMessages.filesHeader)}</h4>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.filesUpload}/>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className='col-sm-4'>
                            <div className='section'>
                                <div className='section--lower'>
                                    <h3 className='section-title'><strong>{formatMessage(modalMessages.browserHeader)}</strong></h3>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserChannelPrev}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserChannelNext}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserFontIncrease}/>
                                    <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserFontDecrease}/>
                                    <div className='subsection'>
                                        <h4 className='subsection-title'>{formatMessage(modalMessages.browserInputHeader)}</h4>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserHighlightPrev}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserHighlightNext}/>
                                        <KeyboardShortcutSequence shortcut={KEYBOARD_SHORTCUTS.browserNewline}/>
                                    </div>
                                </div>
                            </div>
                            { callsEnabled &&
                            <div className='section'>
                                <div>
                                    <h3 className='section-title'><strong>{formatMessage(modalMessages.callsHeader)}</strong></h3>
                                    <div className='subsection'>
                                        <h4 className='subsection-title'>{formatMessage(modalMessages.callsGlobalHeader)}</h4>
                                        {renderShortcutSequences(KEYBOARD_SHORTCUTS.calls.global)}
                                    </div>

                                    <div className='subsection'>
                                        <h4 className='subsection-title'>{formatMessage(modalMessages.callsWidgetHeader)}</h4>
                                        {renderShortcutSequences(KEYBOARD_SHORTCUTS.calls.widget)}
                                    </div>
                                    <div className='subsection'>
                                        <h4 className='subsection-title'>{formatMessage(modalMessages.callsExpandedHeader)}</h4>
                                        {renderShortcutSequences(KEYBOARD_SHORTCUTS.calls.popout)}
                                    </div>
                                </div>
                            </div>
                            }
                        </div>
                    </div>
                    <div className='info__label'>{formatMessage(modalMessages.info)}</div>
                </Modal.Body>
            </div>
        </Modal>
    );
};

export default KeyboardShortcutsModal;
