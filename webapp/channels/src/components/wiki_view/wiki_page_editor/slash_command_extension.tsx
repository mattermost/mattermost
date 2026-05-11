// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';
import type {Editor, Range} from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type {SuggestionOptions, SuggestionProps, SuggestionKeyDownProps} from '@tiptap/suggestion';
import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import {getCurrentLocale, getTranslations} from 'selectors/i18n';
import store from 'stores/redux_store';

import {filterFormattingActions, type FormattingAction} from './formatting_actions';
import SlashCommandMenu from './slash_command_menu';
import type {SlashCommandMenuRef} from './slash_command_menu';

const SLASH_MENU_Z_INDEX = 1000;
const SLASH_MENU_HEIGHT = 400;

type SlashCommandOptions = {
    onOpenLinkModal: () => void;
    onOpenImageModal: () => void;
    onOpenEmojiPicker: () => void;
    suggestion: Partial<SuggestionOptions>;
};

export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
    name: 'slashCommand',

    addOptions() {
        return {
            onOpenLinkModal: () => {},
            onOpenImageModal: () => {},
            onOpenEmojiPicker: () => {},
            suggestion: {
                char: '/',
                allowSpaces: false,
                allowedPrefixes: null,
                startOfLine: true,
                items: ({query}: {query: string}): FormattingAction[] => {
                    return filterFormattingActions(query);
                },
            } as Partial<SuggestionOptions>,
        };
    },

    addProseMirrorPlugins() {
        // Per-extension-instance state. Each editor gets its own SlashCommandExtension
        // and therefore its own state — this avoids the cross-editor interference that
        // module-scoped state would cause when two editors are mounted simultaneously.
        let lastValidRange: {from: number; to: number} | null = null;
        const extensionOptions = {
            onOpenLinkModal: this.options.onOpenLinkModal,
            onOpenImageModal: this.options.onOpenImageModal,
            onOpenEmojiPicker: this.options.onOpenEmojiPicker,
        };

        const render = () => {
            const POPUP_ID = 'tiptap-slash-command-popup-singleton';
            let popup: HTMLElement | null = null;
            let root: Root | null = null;
            let componentRef: SlashCommandMenuRef | null = null;
            let currentItems: FormattingAction[] = [];
            let commandFunction: ((item: FormattingAction) => void) | null = null;
            let locale = '';
            let messages: Record<string, string> = {};

            const closePopup = () => {
                const existingPopup = document.getElementById(POPUP_ID);
                try {
                    if (root) {
                        root.unmount();
                    }
                } finally {
                    root = null;
                    if (existingPopup && existingPopup.parentNode) {
                        existingPopup.parentNode.removeChild(existingPopup);
                    }
                    popup = null;
                    componentRef = null;
                    document.removeEventListener('mousedown', handleClickAway);
                }
            };

            const handleClickAway = (event: MouseEvent) => {
                const popupElement = document.getElementById(POPUP_ID);
                if (popupElement && !popupElement.contains(event.target as Node)) {
                    closePopup();
                }
            };

            const renderComponent = (items: FormattingAction[]) => {
                if (popup && commandFunction) {
                    if (!root) {
                        root = createRoot(popup);
                    }
                    root.render(
                        <Provider store={store}>
                            <IntlProvider
                                locale={locale}
                                messages={messages}
                            >
                                <SlashCommandMenu
                                    ref={(ref) => {
                                        componentRef = ref;
                                    }}
                                    items={items}
                                    command={(item: FormattingAction) => {
                                        if (commandFunction) {
                                            commandFunction(item);
                                        }
                                        closePopup();
                                    }}
                                />
                            </IntlProvider>
                        </Provider>,
                    );
                }
            };

            return {
                onStart: (props: SuggestionProps<FormattingAction>) => {
                    const {items, command, clientRect, range} = props;
                    currentItems = items || [];
                    commandFunction = command;

                    lastValidRange = range;

                    const state = store.getState();
                    locale = getCurrentLocale(state);
                    messages = getTranslations(state, locale);

                    closePopup();

                    popup = document.createElement('div');
                    popup.id = POPUP_ID;
                    popup.className = 'tiptap-slash-command-popup';
                    document.body.appendChild(popup);

                    if (clientRect) {
                        const rect = clientRect();
                        if (rect) {
                            popup.style.position = 'absolute';
                            popup.style.left = `${rect.left + window.scrollX}px`;
                            popup.style.zIndex = String(SLASH_MENU_Z_INDEX);

                            const menuHeight = SLASH_MENU_HEIGHT;
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const spaceAbove = rect.top;

                            if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
                                popup.style.bottom = `${window.innerHeight - rect.top - window.scrollY}px`;
                                popup.style.top = 'auto';
                            } else {
                                popup.style.top = `${rect.bottom + window.scrollY}px`;
                                popup.style.bottom = 'auto';
                            }
                        }
                    }

                    renderComponent(items);

                    setTimeout(() => {
                        document.addEventListener('mousedown', handleClickAway);
                    }, 0);
                },

                onUpdate: (props: SuggestionProps<FormattingAction>) => {
                    const {items, clientRect, range} = props;
                    currentItems = items || [];

                    lastValidRange = range;

                    if (popup && clientRect) {
                        const rect = clientRect();
                        if (rect) {
                            popup.style.left = `${rect.left + window.scrollX}px`;

                            const menuHeight = SLASH_MENU_HEIGHT;
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const spaceAbove = rect.top;

                            if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
                                popup.style.bottom = `${window.innerHeight - rect.top - window.scrollY}px`;
                                popup.style.top = 'auto';
                            } else {
                                popup.style.top = `${rect.bottom + window.scrollY}px`;
                                popup.style.bottom = 'auto';
                            }
                        }
                    }

                    renderComponent(currentItems);
                },

                onKeyDown: (props: SuggestionKeyDownProps) => {
                    // Escape: return false so TipTap's Suggestion plugin transitions to
                    // exited state and fires onExit (which performs the cleanup).
                    if (props.event.key === 'Escape') {
                        return false;
                    }

                    if (!componentRef) {
                        return false;
                    }

                    return componentRef.onKeyDown(props.event);
                },

                onExit: () => {
                    closePopup();
                },
            };
        };

        const command = ({editor, range, props}: {editor: Editor; range: Range; props: FormattingAction}) => {
            const rangeToUse = lastValidRange || range;

            editor.chain().focus().deleteRange(rangeToUse).run();

            lastValidRange = null;

            if (props.requiresModal && props.modalType === 'link') {
                extensionOptions.onOpenLinkModal();
                return;
            }

            if (props.requiresModal && props.modalType === 'image') {
                extensionOptions.onOpenImageModal();
                return;
            }

            if (props.requiresModal && props.modalType === 'emoji') {
                extensionOptions.onOpenEmojiPicker();
                return;
            }

            props.command(editor);
        };

        return [
            // eslint-disable-next-line new-cap
            Suggestion({
                editor: this.editor,
                ...(this.options.suggestion || {}),
                render,
                command,
            }),
        ];
    },
});
