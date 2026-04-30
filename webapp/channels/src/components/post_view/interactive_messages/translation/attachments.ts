// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Legacy Attachments (`props.attachments`) → mm_blocks

import truncate from 'lodash/truncate';

import type {
    MmBlock,
    MmColumnBlock,
    MmColumnSetBlock,
    MmContainerBlock,
    MmStaticSelectOption,
} from '@mattermost/types/mm_blocks';

import Constants from 'utils/constants';
import {isUrlSafe} from 'utils/url';

import {normaliseButtonStyle} from './shared';

/** Matches legacy `.attachment__author-icon` in `_webhooks.scss` (14×14). Markdown: `![alt](url =WxH)`. */
const AUTHOR_ICON_MARKDOWN_SIZE = ' =14x14';

/** Matches legacy `.attachment__footer-icon` in `message_attachment.tsx` (16×16). */
const FOOTER_ICON_MARKDOWN_SIZE = ' =16x16';

/** Placeholder so the stretch column still exists when the body is otherwise empty (thumb-only attachment). */
const COLUMN_PLACEHOLDER_TEXT = '\u200b';

type ParsedAttachmentField = {
    title: string;
    value: string;
    short: boolean;
};

export function translateAttachments(attachments: unknown[]): MmBlock[] {
    const result: MmBlock[] = [];
    for (const attachment of attachments) {
        if (typeof attachment !== 'object' || attachment === null) {
            continue;
        }
        const a = attachment as Record<string, unknown>;

        const colorRaw = typeof a.color === 'string' ? a.color.trim() : '';
        const accentColor = colorRaw.length > 0 ? colorRaw : 'rgba(var(--link-color-rgb), 0.5)';
        const pretext =
            typeof a.pretext === 'string' && a.pretext.length > 0 ? a.pretext : undefined;
        const thumbUrl =
            typeof a.thumb_url === 'string' && a.thumb_url.length > 0 ? a.thumb_url : undefined;

        const prefixItems: MmBlock[] = [];

        const authorText = buildAttachmentAuthorMarkdown(
            typeof a.author_name === 'string' ? a.author_name : undefined,
            typeof a.author_link === 'string' ? a.author_link : undefined,
            typeof a.author_icon === 'string' ? a.author_icon : undefined,
        );
        if (authorText) {
            prefixItems.push({type: 'text', text: authorText});
        }

        if (typeof a.title === 'string' && a.title) {
            prefixItems.push({
                type: 'text',
                text: buildAttachmentTitleMarkdown(
                    a.title,
                    typeof a.title_link === 'string' ? a.title_link : undefined,
                ),
            });
        }

        const mainBodyItems: MmBlock[] = [];

        if (typeof a.text === 'string' && a.text) {
            mainBodyItems.push({type: 'text', text: a.text});
        }

        if (typeof a.image_url === 'string' && a.image_url) {
            mainBodyItems.push({
                type: 'image',
                url: a.image_url,
                alt_text: 'Attachment image',
                size: 'medium',
            });
        }

        if (Array.isArray(a.fields)) {
            const parsedFields = parseAttachmentFields(a.fields);
            const fieldsContainer = attachmentFieldsToMmBlocks(parsedFields);
            if (fieldsContainer) {
                mainBodyItems.push(fieldsContainer);
            }
        }

        if (typeof a.footer === 'string' && a.footer) {
            const footerBody = truncate(a.footer, {length: Constants.MAX_ATTACHMENT_FOOTER_LENGTH, omission: '…'});
            const icon = typeof a.footer_icon === 'string' && a.footer_icon ? `![](${a.footer_icon}${FOOTER_ICON_MARKDOWN_SIZE}) ` : '';
            mainBodyItems.push({
                type: 'text',
                text: `${icon}${footerBody}`,
                is_subtle: true,
                size: 'small',
            });
        }

        let actionsBlock: MmBlock | null = null;
        if (Array.isArray(a.actions) && a.actions.length > 0) {
            actionsBlock = translateAttachmentActions(a.actions);
        }

        const items: MmBlock[] = [...prefixItems];

        if (thumbUrl) {
            const leftColumnItems: MmBlock[] = [...mainBodyItems];
            if (leftColumnItems.length === 0) {
                leftColumnItems.push({type: 'text', text: COLUMN_PLACEHOLDER_TEXT});
            }
            const thumbColumn: MmColumnBlock = {
                type: 'column',
                width: 'auto',
                items: [{
                    type: 'image',
                    url: thumbUrl,
                    alt_text: 'Attachment image',
                    size: 'small',
                }],
            };
            const columnSet: MmColumnSetBlock = {
                type: 'column_set',
                columns: [
                    {type: 'column', width: 'stretch', items: leftColumnItems},
                    thumbColumn,
                ],
            };
            items.push(columnSet);
        } else {
            items.push(...mainBodyItems);
        }

        if (actionsBlock) {
            items.push(actionsBlock);
        }

        const hasInnerBody = items.length > 0;
        if (!hasInnerBody && !pretext) {
            continue;
        }

        // Pretext is a sibling `text` block before the bordered `container`, matching legacy layout
        // (pretext outside `.attachment__content` — see `message_attachment.tsx`).
        if (pretext) {
            result.push({type: 'text', text: pretext});
        }

        if (!hasInnerBody) {
            continue;
        }

        result.push({
            type: 'container',
            border: true,
            accent_color: accentColor,
            content: items,
        });
    }
    return result;
}

function buildAttachmentAuthorMarkdown(
    authorName: string | undefined,
    authorLink: string | undefined,
    authorIcon: string | undefined,
): string | null {
    const parts: string[] = [];
    if (authorIcon) {
        parts.push(`![](${authorIcon}${AUTHOR_ICON_MARKDOWN_SIZE})`);
    }
    if (authorName) {
        if (authorLink && isUrlSafe(authorLink)) {
            parts.push(`[${authorName}](${authorLink})`);
        } else {
            parts.push(authorName);
        }
    }
    if (parts.length === 0) {
        return null;
    }
    return parts.join(' ');
}

function buildAttachmentTitleMarkdown(title: string, titleLink: string | undefined): string {
    if (titleLink && isUrlSafe(titleLink)) {
        return `**[${title}](${titleLink})**`;
    }
    return `**${title}**`;
}

function parseAttachmentFields(fields: unknown): ParsedAttachmentField[] {
    if (!Array.isArray(fields)) {
        return [];
    }
    const result: ParsedAttachmentField[] = [];
    for (const f of fields) {
        if (typeof f !== 'object' || f === null) {
            continue;
        }
        const field = f as Record<string, unknown>;
        if (typeof field.title !== 'string' || !field.title) {
            continue;
        }
        const valueStr = formatAttachmentFieldValue(field.value);
        if (!valueStr) {
            continue;
        }
        result.push({
            title: field.title,
            value: valueStr,
            short: field.short === true,
        });
    }
    return result;
}

function attachmentFieldMarkdown(f: ParsedAttachmentField): string {
    const title = f.title.trim();
    const value = f.value.trim();

    // Two spaces before newline = Markdown hard line break: label on its own line, value below,
    // without the large gap that `\n\n` (new paragraph) creates.
    return `**${title}:**  \n${value}`;
}

function attachmentFieldsToMmBlocks(parsed: ParsedAttachmentField[]): MmContainerBlock | null {
    if (parsed.length === 0) {
        return null;
    }
    const content: MmBlock[] = [];
    let pending: ParsedAttachmentField | null = null;

    for (const field of parsed) {
        if (field.short) {
            if (pending) {
                const left: MmColumnBlock = {
                    type: 'column',
                    width: 'stretch',
                    items: [{
                        type: 'text',
                        text: attachmentFieldMarkdown(pending),
                    }],
                };
                const right: MmColumnBlock = {
                    type: 'column',
                    width: 'stretch',
                    items: [{
                        type: 'text',
                        text: attachmentFieldMarkdown(field),
                    }],
                };
                content.push({type: 'column_set', columns: [left, right]});
                pending = null;
            } else {
                pending = field;
            }
        } else {
            if (pending) {
                content.push({
                    type: 'text',
                    text: attachmentFieldMarkdown(pending),
                });
                pending = null;
            }
            content.push({
                type: 'text',
                text: attachmentFieldMarkdown(field),
            });
        }
    }
    if (pending) {
        content.push({
            type: 'text',
            text: attachmentFieldMarkdown(pending),
        });
    }
    return {
        type: 'container',
        flow: 'vertical',
        gap: 'medium',
        content,
    };
}

function formatAttachmentFieldValue(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (typeof value === 'object' && 'toString' in value && typeof (value as {toString: unknown}).toString === 'function') {
        return String(value);
    }
    return '';
}

function translateAttachmentActions(actions: unknown[]) {
    const result: MmContainerBlock = {
        type: 'container',
        flow: 'horizontal',
        content: [],
    };
    for (const action of actions) {
        if (typeof action !== 'object' || action === null) {
            continue;
        }
        const act = action as Record<string, unknown>;
        if (act.type === 'button') {
            const text = typeof act.name === 'string' ? act.name : '';
            const actionId = typeof act.id === 'string' ? act.id : '';
            if (!text || !actionId) {
                continue;
            }
            result.content.push({
                type: 'button',
                action_id: actionId,
                text,
                style: normaliseButtonStyle(typeof act.style === 'string' ? act.style : undefined),
                tooltip: typeof act.tooltip === 'string' ? act.tooltip : undefined,
                disabled: act.disabled === true ? true : undefined,
                cookie: typeof act.cookie === 'string' ? act.cookie : undefined,
            });
        } else if (act.type === 'select') {
            const placeholder = typeof act.name === 'string' ? act.name : '';
            const actionId = typeof act.id === 'string' ? act.id : '';
            if (!actionId) {
                continue;
            }
            const dataSource = typeof act.data_source === 'string' ? act.data_source : undefined;
            let options;
            if (dataSource !== 'users' && dataSource !== 'channels') {
                options = translateAttachmentSelectOptions(act.options);
                if (options.length === 0) {
                    continue;
                }
            }

            result.content.push({
                type: 'static_select',
                action_id: actionId,
                placeholder,
                options,
                initial_option: typeof act.default_option === 'string' ? act.default_option : undefined,
                disabled: act.disabled === true ? true : undefined,
                cookie: typeof act.cookie === 'string' ? act.cookie : undefined,
                data_source: typeof act.data_source === 'string' ? act.data_source : undefined,
            });
        }
    }
    if (result.content.length === 0) {
        return null;
    }
    return result;
}

function translateAttachmentSelectOptions(options: unknown): MmStaticSelectOption[] {
    if (!Array.isArray(options)) {
        return [];
    }
    const result: MmStaticSelectOption[] = [];
    for (const opt of options) {
        if (typeof opt !== 'object' || opt === null) {
            continue;
        }
        const o = opt as Record<string, unknown>;
        if (typeof o.text === 'string' && o.text && typeof o.value === 'string' && o.value) {
            result.push({text: o.text, value: o.value});
        }
    }
    return result;
}
