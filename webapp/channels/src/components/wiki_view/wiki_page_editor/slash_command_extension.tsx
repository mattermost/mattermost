// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';
import type {Editor, Range} from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type {SuggestionOptions, SuggestionProps, SuggestionKeyDownProps} from '@tiptap/suggestion';
import React from 'react';
import {createRoot, type Root} from 'react-dom/client';

import {filterFormattingActions, type FormattingAction} from './formatting_actions';
import SlashCommandMenu from './slash_command_menu';
import type {SlashCommandMenuRef} from './slash_command_menu';

const SLASH_MENU_Z_INDEX = 1000;
const SLASH_MENU_HEIGHT = 400;

// Global state for slash command menu to prevent conflicts between multiple editor instances
let globalExitTimeout: ReturnType<typeof setTimeout> | null = null;
let globalLastValidRange: {from: number; to: number} | null = null;
let globalExtensionOptions: {onOpenLinkModal: () => void; onOpenImageModal: () => void; onOpenEmojiPicker: () => void} | null = null;

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
                render: () => {
                    const POPUP_ID = 'tiptap-slash-command-popup-singleton';
                    let popup: HTMLElement | null = null;
                    let root: Root | null = null;
                    let componentRef: SlashCommandMenuRef | null = null;
                    let currentItems: FormattingAction[] = [];
                    let commandFunction: ((item: FormattingAction) => void) | null = null;

                    const closePopup = () => {
                        const existingPopup = document.getElementById(POPUP_ID);
                        if (root) {
                            root.unmount();
                            root = null;
                        }
                        if (existingPopup && existingPopup.parentNode) {
                            existingPopup.parentNode.removeChild(existingPopup);
                        }
                        popup = null;
                        componentRef = null;

                        document.removeEventListener('mousedown', handleClickAway);
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
                                />,
                            );
                        }
                    };

                    return {
                        onStart: (props: SuggestionProps<FormattingAction>) => {
                            const {items, command, clientRect, range} = props;
                            currentItems = items || [];
                            commandFunction = command;

                            globalLastValidRange = range;

                            if (globalExitTimeout) {
                                clearTimeout(globalExitTimeout);
                                globalExitTimeout = null;
                            }

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

                            globalLastValidRange = range;

                            if (globalExitTimeout) {
                                clearTimeout(globalExitTimeout);
                                globalExitTimeout = null;
                            }

                            if (popup && clientRect) {
                                const rect = clientRect();
                                if (rect) {
                                    popup.style.left = `${rect.left + window.scrollX}px`;

                                    const menuHeight = 400;
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
                            if (props.event.key === 'Escape') {
                                closePopup();
                                return true;
                            }

                            if (!componentRef) {
                                return false;
                            }

                            return componentRef.onKeyDown(props.event);
                        },

                        onExit: () => {
                            // No cleanup needed
                        },
                    };
                },
                command: ({editor, range, props}: {editor: Editor; range: Range; props: FormattingAction}) => {
                    const rangeToUse = globalLastValidRange || range;

                    editor.chain().focus().deleteRange(rangeToUse).run();

                    globalLastValidRange = null;

                    if (props.requiresModal && props.modalType === 'link') {
                        globalExtensionOptions?.onOpenLinkModal();
                        return;
                    }

                    if (props.requiresModal && props.modalType === 'image') {
                        globalExtensionOptions?.onOpenImageModal();
                        return;
                    }

                    if (props.requiresModal && props.modalType === 'emoji') {
                        globalExtensionOptions?.onOpenEmojiPicker();
                        return;
                    }

                    props.command(editor);
                },
            } as Partial<SuggestionOptions>,
        };
    },

    addProseMirrorPlugins() {
        globalExtensionOptions = {
            onOpenLinkModal: this.options.onOpenLinkModal,
            onOpenImageModal: this.options.onOpenImageModal,
            onOpenEmojiPicker: this.options.onOpenEmojiPicker,
        };

        return [
            // eslint-disable-next-line new-cap
            Suggestion({
                editor: this.editor,
                ...(this.options.suggestion || {}),
            }),
        ];
    },
});
