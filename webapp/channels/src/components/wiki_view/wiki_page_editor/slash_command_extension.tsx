// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type {SuggestionOptions} from '@tiptap/suggestion';
import React from 'react';
import ReactDOM from 'react-dom';

import {filterFormattingActions, type FormattingAction} from './formatting_actions';
import SlashCommandMenu from './slash_command_menu';
import type {SlashCommandMenuRef} from './slash_command_menu';

// Global state for slash command menu to prevent conflicts between multiple editor instances
let globalExitTimeout: ReturnType<typeof setTimeout> | null = null;
let globalIsRendering = false;
let globalLastValidRange: {from: number; to: number} | null = null;
let globalExtensionOptions: {onOpenLinkModal: () => void; onOpenImageModal: () => void} | null = null;

export const SlashCommandExtension = Extension.create<{
    onOpenLinkModal: () => void;
    onOpenImageModal: () => void;
    suggestion: Partial<SuggestionOptions>;
}>({
    name: 'slashCommand',

    addOptions() {
        return {
            onOpenLinkModal: () => {},
            onOpenImageModal: () => {},
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
                            let componentRef: SlashCommandMenuRef | null = null;
                            let currentItems: FormattingAction[] = [];
                            let commandFunction: ((item: FormattingAction) => void) | null = null;

                            const closePopup = () => {
                                const existingPopup = document.getElementById(POPUP_ID);
                                if (existingPopup && existingPopup.parentNode) {
                                    ReactDOM.unmountComponentAtNode(existingPopup);
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
                                    ReactDOM.render(
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
                                        popup,
                                    );
                                }
                            };

                            return {
                                onStart: (props: any) => {
                                    const {items, command, clientRect, range} = props;
                                    currentItems = items || [];
                                    commandFunction = command;
                                    globalIsRendering = true;

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
                                            popup.style.top = `${rect.bottom + window.scrollY}px`;
                                            popup.style.left = `${rect.left + window.scrollX}px`;
                                            popup.style.zIndex = '1000';
                                        }
                                    }

                                    renderComponent(items);
                                    globalIsRendering = false;

                                    setTimeout(() => {
                                        document.addEventListener('mousedown', handleClickAway);
                                    }, 0);
                                },

                                onUpdate: (props: any) => {
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
                                            popup.style.top = `${rect.bottom + window.scrollY}px`;
                                            popup.style.left = `${rect.left + window.scrollX}px`;
                                        }
                                    }

                                    renderComponent(currentItems);
                                },

                                onKeyDown: (props: any) => {
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
                                    if (globalIsRendering) {
                                        return;
                                    }
                                },
                            };
                        },
                        command: ({editor, range, props}: {editor: any; range: any; props: FormattingAction}) => {
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

                            props.command(editor);
                        },
                    } as Partial<SuggestionOptions>,
                };
            },

            addProseMirrorPlugins() {
                globalExtensionOptions = {
                    onOpenLinkModal: this.options.onOpenLinkModal,
                    onOpenImageModal: this.options.onOpenImageModal,
                };

                return [
                    Suggestion({
                        editor: this.editor,
                        ...(this.options.suggestion || {}),
                    }),
                ];
            },
        });
