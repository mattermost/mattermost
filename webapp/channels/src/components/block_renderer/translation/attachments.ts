// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Legacy Attachments (`props.attachments`) → mm_blocks

import type {IntlShape} from 'react-intl';

import type {
    MmBlock,
    MmColumnBlock,
    MmColumnSetBlock,
    MmContainerBlock,
    MmStaticSelectOption,
} from '@mattermost/types/mm_blocks';
import {ensureString} from '@mattermost/types/utilities';

import {isUrlSafe} from 'utils/url';

import {parseMmButtonStyle} from '../utils/button';

const AUTHOR_ICON_MAX_PX = 20;
const FOOTER_ICON_MAX_PX = 16;

/** Placeholder so the stretch column still exists when the body is otherwise empty (thumb-only attachment). */
const COLUMN_PLACEHOLDER_TEXT = '\u200b';

type ParsedAttachmentField = {
    title: string;
    value: string;
    short: boolean;
};

export function translateAttachments(attachments: unknown[], intl: IntlShape): MmBlock[] {
    const result: MmBlock[] = [];
    for (const attachment of attachments) {
        if (typeof attachment !== 'object' || attachment === null) {
            continue;
        }
        const a = attachment as Record<string, unknown>;

        const colorRaw = ensureString(a.color).trim();
        const accentColor = colorRaw.length > 0 ? colorRaw : undefined;
        const pretext =
            typeof a.pretext === 'string' && a.pretext.length > 0 ? a.pretext : undefined;
        const thumbUrl =
            typeof a.thumb_url === 'string' && a.thumb_url.length > 0 ? a.thumb_url : undefined;

        const items: MmBlock[] = [];

        const authorBlock = buildAttachmentAuthorBlocks(
            ensureString(a.author_name),
            ensureString(a.author_link),
            ensureString(a.author_icon),
        );
        if (authorBlock) {
            items.push(authorBlock);
        }

        if (typeof a.title === 'string' && a.title) {
            items.push({
                type: 'text',
                text: buildAttachmentTitleMarkdown(
                    a.title,
                    ensureString(a.title_link),
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

        const footer = ensureString(a.footer);
        if (footer.trim()) {
            const footerIconUrl = ensureString(a.footer_icon);
            const footerPieces: MmBlock[] = [];
            if (footerIconUrl) {
                footerPieces.push({
                    type: 'image',
                    url: footerIconUrl,
                    alt_text: intl.formatMessage({id: 'attachment.footerIconAltText', defaultMessage: 'Attachment footer icon'}),
                    size: 'auto',
                    max_width: FOOTER_ICON_MAX_PX,
                    max_height: FOOTER_ICON_MAX_PX,
                });
            }
            footerPieces.push({
                type: 'text',
                text: footer,
                is_subtle: true,
                size: 'small',
            });
            mainBodyItems.push(wrapHorizontalFooterRow(footerPieces));
        }

        let actionsBlock: MmBlock | null = null;
        if (Array.isArray(a.actions) && a.actions.length > 0) {
            actionsBlock = translateAttachmentActions(a.actions);
        }

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
                    alt_text: intl.formatMessage({id: 'attachment.imageAltText', defaultMessage: 'Attachment image'}),
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

        // Pretext is a sibling `text` block before the bordered `container`, matching legacy layout
        // (pretext outside `.attachment__content` — see `message_attachment.tsx`).
        if (pretext) {
            result.push({type: 'text', text: pretext});
        }

        if (items.length) {
            result.push({
                type: 'container',
                border: true,
                accent_color: accentColor,
                content: items,
            });
        }
    }
    return result;
}

function buildAttachmentAuthorBlocks(
    authorName: string | undefined,
    authorLink: string | undefined,
    authorIcon: string | undefined,
): MmBlock | null {
    const blocks: MmBlock[] = [];
    if (authorIcon) {
        blocks.push({
            type: 'image',
            url: authorIcon,
            alt_text: 'Attachment author icon',
            size: 'auto',
            max_width: AUTHOR_ICON_MAX_PX,
            max_height: AUTHOR_ICON_MAX_PX,
        });
    }
    const nameMarkdown = buildAttachmentAuthorNameMarkdown(authorName, authorLink);
    if (nameMarkdown) {
        blocks.push({type: 'text', text: nameMarkdown});
    }
    if (blocks.length === 0) {
        return null;
    }
    if (blocks.length === 1) {
        return blocks[0];
    }
    return {
        type: 'container',
        flow: 'horizontal',
        gap: 'small',
        content: blocks,
    };
}

function buildAttachmentAuthorNameMarkdown(
    authorName: string | undefined,
    authorLink: string | undefined,
): string | null {
    if (!authorName) {
        return null;
    }
    if (authorLink && isUrlSafe(authorLink)) {
        return `[${authorName}](${authorLink})`;
    }
    return authorName;
}

/** Footer text alone stays a single text block; icon + text uses a horizontal container. */
function wrapHorizontalFooterRow(blocks: MmBlock[]): MmBlock {
    if (blocks.length === 1) {
        return blocks[0];
    }
    return {
        type: 'container',
        flow: 'horizontal',
        gap: 'small',
        content: blocks,
    };
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

function attachmentFieldBlocks(f: ParsedAttachmentField): MmBlock[] {
    const blocks: MmBlock[] = [];
    blocks.push({type: 'text', text: `**${f.title}:**`});
    blocks.push({type: 'text', text: f.value});
    return blocks;
}

function wrapAttachmenFieldBlocks(blocks: MmBlock[]): MmBlock {
    return {
        type: 'container',
        flow: 'vertical',
        gap: 'none',
        content: blocks,
    };
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
                    gap: 'none',
                    items: attachmentFieldBlocks(pending),
                };
                const right: MmColumnBlock = {
                    type: 'column',
                    width: 'stretch',
                    gap: 'none',
                    items: attachmentFieldBlocks(field),
                };
                content.push({type: 'column_set', columns: [left, right]});
                pending = null;
            } else {
                pending = field;
            }
        } else {
            if (pending) {
                content.push(wrapAttachmenFieldBlocks(attachmentFieldBlocks(pending)));
                pending = null;
            }
            content.push(wrapAttachmenFieldBlocks(attachmentFieldBlocks(field)));
        }
    }
    if (pending) {
        content.push(wrapAttachmenFieldBlocks(attachmentFieldBlocks(pending)));
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
        gap: 'medium',
        content: [],
    };
    for (const action of actions) {
        if (typeof action !== 'object' || action === null) {
            continue;
        }
        const act = action as Record<string, unknown>;
        if (act.type === 'select') {
            const placeholder = ensureString(act.name);
            const actionId = ensureString(act.id);
            if (!actionId) {
                continue;
            }
            const dataSource = ensureString(act.data_source);
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
                initial_option: ensureString(act.default_option),
                disabled: act.disabled === true ? true : undefined,
                cookie: ensureString(act.cookie),
                data_source: dataSource,
            });
        } else {
            // Legacy attachment actions without `type` render as buttons (see message_attachment.tsx).
            const text = ensureString(act.name);
            const actionId = ensureString(act.id);
            if (!text || !actionId) {
                continue;
            }
            result.content.push({
                type: 'button',
                action_id: actionId,
                text,
                style: parseMmButtonStyle(ensureString(act.style)),
                tooltip: ensureString(act.tooltip),
                disabled: act.disabled === true ? true : undefined,
                cookie: ensureString(act.cookie),
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
