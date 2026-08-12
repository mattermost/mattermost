// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    MmBlock,
    MmButtonStyle,
    MmColumnBlock,
    MmContainerBackground,
    MmContainerGap,
    MmContainerMaxHeight,
    MmImageSize,
    MmStaticSelectOption,
    MmTextSize,
} from '@mattermost/types/mm_blocks';

/** Identifies which child array a path segment refers to. */
export type ChildListKey = 'root' | 'content' | 'items' | 'columns' | 'header';

export type PathSegment = {
    list: ChildListKey;
    index: number;
};

export type BlockPath = PathSegment[];

export type AddBlockTarget = 'sibling' | 'child';

export type BlockTypeId =
    | 'text' |
    'divider' |
    'button' |
    'static_select' |
    'image' |
    'column' |
    'column_set' |
    'container' |
    'collapsible';

export type PropertyFieldType = 'string' | 'number' | 'boolean' | 'enum' | 'json';

export type PropertyField = {
    key: string;
    label: string;
    type: PropertyFieldType;
    options?: string[];
    placeholder?: string;
};

export const ROOT_ADDABLE_TYPES: BlockTypeId[] = [
    'text',
    'divider',
    'button',
    'static_select',
    'image',
    'container',
    'column_set',
    'collapsible',
];

export const COLUMN_SET_ADDABLE_TYPES: BlockTypeId[] = ['column'];

const BLOCK_TYPE_LABELS: Record<BlockTypeId, string> = {
    text: 'Text',
    divider: 'Divider',
    button: 'Button',
    static_select: 'Static select',
    image: 'Image',
    column: 'Column',
    column_set: 'Column set',
    container: 'Container',
    collapsible: 'Collapsible',
};

export function blockTypeLabel(type: BlockTypeId): string {
    return BLOCK_TYPE_LABELS[type];
}

export function createDefaultBlock(type: BlockTypeId): MmBlock {
    switch (type) {
    case 'text':
        return {type: 'text', text: 'New text'};
    case 'divider':
        return {type: 'divider'};
    case 'button':
        return {type: 'button', text: 'Button', action_id: 'action_id', style: 'default'};
    case 'static_select':
        return {
            type: 'static_select',
            action_id: 'select_action',
            placeholder: 'Choose an option',
            options: [
                {text: 'Option A', value: 'a'},
                {text: 'Option B', value: 'b'},
            ],
        };
    case 'image':
        return {
            type: 'image',
            url: 'https://example.com/image.png',
            alt_text: 'Image description',
        };
    case 'column':
        return {
            type: 'column',
            items: [{type: 'text', text: 'Column content'}],
        };
    case 'column_set':
        return {
            type: 'column_set',
            columns: [
                {
                    type: 'column',
                    items: [{type: 'text', text: 'Column 1'}],
                },
                {
                    type: 'column',
                    items: [{type: 'text', text: 'Column 2'}],
                },
            ],
        };
    case 'container':
        return {
            type: 'container',
            content: [{type: 'text', text: 'Container content'}],
        };
    case 'collapsible':
        return {
            type: 'collapsible',
            header: [{type: 'text', text: 'Header'}],
            content: [{type: 'text', text: 'Collapsed content'}],
        };
    default:
        return {type: 'text', text: 'New text'};
    }
}

export function serializeMmBlocks(blocks: MmBlock[]): string {
    return JSON.stringify(blocks, null, 2);
}

function getChildList(block: MmBlock | MmColumnBlock, list: ChildListKey): MmBlock[] | MmColumnBlock[] | null {
    switch (block.type) {
    case 'container':
        if (list === 'content') {
            return block.content;
        }
        return null;
    case 'column':
        if (list === 'items') {
            return block.items;
        }
        return null;
    case 'column_set':
        if (list === 'columns') {
            return block.columns;
        }
        return null;
    case 'collapsible':
        if (list === 'header') {
            return block.header;
        }
        if (list === 'content') {
            return block.content;
        }
        return null;
    default:
        return null;
    }
}

export function getBlockAt(root: MmBlock[], path: BlockPath): MmBlock | MmColumnBlock | null {
    if (path.length === 0) {
        return null;
    }
    let list: Array<MmBlock | MmColumnBlock> = root;
    let block: MmBlock | MmColumnBlock | null = null;
    for (const segment of path) {
        if (segment.list === 'root') {
            block = list[segment.index] ?? null;
        } else if (block) {
            const childList = getChildList(block, segment.list);
            if (!childList) {
                return null;
            }
            list = childList;
            block = list[segment.index] ?? null;
        } else {
            return null;
        }
    }
    return block;
}

export function getParentContext(
    root: MmBlock[],
    path: BlockPath,
): {list: MmBlock[] | MmColumnBlock[]; index: number; parentBlock: MmBlock | MmColumnBlock | null} | null {
    if (path.length === 0) {
        return null;
    }
    const last = path[path.length - 1];
    if (path.length === 1) {
        return {list: root, index: last.index, parentBlock: null};
    }
    const parentPath = path.slice(0, -1);
    const parentBlock = getBlockAt(root, parentPath);
    if (!parentBlock || last.list === 'root') {
        return null;
    }
    const list = getChildList(parentBlock, last.list);
    if (!list) {
        return null;
    }
    return {list, index: last.index, parentBlock};
}

export function cloneBlocks(blocks: MmBlock[]): MmBlock[] {
    return JSON.parse(JSON.stringify(blocks)) as MmBlock[];
}

export function updateBlockAt(root: MmBlock[], path: BlockPath, next: MmBlock | MmColumnBlock): MmBlock[] {
    const draft = cloneBlocks(root);
    const ctx = getParentContext(draft, path);
    if (!ctx) {
        return draft;
    }
    ctx.list[ctx.index] = next as MmBlock & MmColumnBlock;
    return draft;
}

export function removeBlockAt(root: MmBlock[], path: BlockPath): MmBlock[] {
    const draft = cloneBlocks(root);
    const ctx = getParentContext(draft, path);
    if (!ctx) {
        return draft;
    }
    ctx.list.splice(ctx.index, 1);
    return draft;
}

export function insertBlockAt(
    root: MmBlock[],
    path: BlockPath,
    block: MmBlock | MmColumnBlock,
    target: AddBlockTarget,
): MmBlock[] {
    const draft = cloneBlocks(root);
    if (target === 'sibling') {
        const ctx = getParentContext(draft, path);
        if (!ctx) {
            return draft;
        }
        ctx.list.splice(ctx.index + 1, 0, block as MmBlock & MmColumnBlock);
        return draft;
    }

    const current = getBlockAt(draft, path);
    if (!current) {
        return draft;
    }
    const childListKey = defaultChildListKey(current);
    if (!childListKey) {
        return draft;
    }
    const list = getChildList(current, childListKey);
    if (!list) {
        return draft;
    }
    list.push(block as MmBlock & MmColumnBlock);
    return draft;
}

function defaultChildListKey(block: MmBlock | MmColumnBlock): ChildListKey | null {
    switch (block.type) {
    case 'container':
        return 'content';
    case 'column':
        return 'items';
    case 'column_set':
        return 'columns';
    case 'collapsible':
        return 'content';
    default:
        return null;
    }
}

export function canAddChild(block: MmBlock | MmColumnBlock): boolean {
    return defaultChildListKey(block) !== null;
}

export function addableTypesForList(list: ChildListKey): BlockTypeId[] {
    if (list === 'columns') {
        return COLUMN_SET_ADDABLE_TYPES;
    }
    return ROOT_ADDABLE_TYPES;
}

export function pathKey(path: BlockPath): string {
    return path.map((s) => `${s.list}:${s.index}`).join('/');
}

export function parsePathKey(key: string): BlockPath | null {
    if (!key) {
        return null;
    }
    const segments: BlockPath = [];
    for (const part of key.split('/')) {
        const colon = part.indexOf(':');
        if (colon === -1) {
            return null;
        }
        const list = part.slice(0, colon) as ChildListKey;
        const index = Number.parseInt(part.slice(colon + 1), 10);
        if (!Number.isFinite(index) || index < 0) {
            return null;
        }
        segments.push({list, index});
    }
    return segments.length > 0 ? segments : null;
}

export function parentPathKey(path: BlockPath): string {
    if (path.length <= 1) {
        return '';
    }
    return pathKey(path.slice(0, -1));
}

/** True when both paths refer to siblings in the same array (same parent, same list key). */
export function sameParentList(a: BlockPath, b: BlockPath): boolean {
    if (a.length === 0 || b.length === 0) {
        return false;
    }
    const aLast = a[a.length - 1];
    const bLast = b[b.length - 1];
    if (aLast.list !== bLast.list) {
        return false;
    }
    if (a.length === 1 && b.length === 1) {
        return aLast.list === 'root' && bLast.list === 'root';
    }
    if (a.length !== b.length) {
        return false;
    }
    return parentPathKey(a) === parentPathKey(b);
}

export function moveBlockAt(root: MmBlock[], fromPath: BlockPath, toIndex: number): MmBlock[] {
    const ctx = getParentContext(root, fromPath);
    if (!ctx || toIndex < 0 || toIndex >= ctx.list.length) {
        return root;
    }
    const fromIndex = ctx.index;
    if (fromIndex === toIndex) {
        return root;
    }
    const draft = cloneBlocks(root);
    const draftCtx = getParentContext(draft, fromPath);
    if (!draftCtx) {
        return draft;
    }
    const [item] = draftCtx.list.splice(draftCtx.index, 1);
    draftCtx.list.splice(toIndex, 0, item);
    return draft;
}

/** Updates a path after a sibling reorder in the same list. */
export function remapPathAfterMove(path: BlockPath, fromPath: BlockPath, toIndex: number): BlockPath {
    if (!sameParentList(path, fromPath)) {
        return path;
    }
    const fromIndex = fromPath[fromPath.length - 1].index;
    const last = path[path.length - 1];

    if (pathKey(path) === pathKey(fromPath)) {
        return [...path.slice(0, -1), {list: last.list, index: toIndex}];
    }

    const pathIndex = last.index;
    if (fromIndex < pathIndex && pathIndex <= toIndex) {
        return [...path.slice(0, -1), {list: last.list, index: pathIndex - 1}];
    }
    if (toIndex <= pathIndex && pathIndex < fromIndex) {
        return [...path.slice(0, -1), {list: last.list, index: pathIndex + 1}];
    }
    return path;
}

export const MM_BLOCKS_DRAG_MIME = 'application/x-mm-block-path';

export function listLabel(list: ChildListKey): string | null {
    switch (list) {
    case 'content':
        return 'content';
    case 'items':
        return 'items';
    case 'columns':
        return 'columns';
    case 'header':
        return 'header';
    default:
        return null;
    }
}

export function childPaths(block: MmBlock | MmColumnBlock, parentPath: BlockPath): BlockPath[] {
    const paths: BlockPath[] = [];
    const appendChildren = (list: ChildListKey, items: Array<MmBlock | MmColumnBlock>) => {
        items.forEach((_, index) => {
            paths.push([...parentPath, {list, index}]);
        });
    };

    switch (block.type) {
    case 'container':
        appendChildren('content', block.content);
        break;
    case 'column':
        appendChildren('items', block.items);
        break;
    case 'column_set':
        appendChildren('columns', block.columns);
        break;
    case 'collapsible':
        appendChildren('header', block.header);
        appendChildren('content', block.content);
        break;
    default:
        break;
    }
    return paths;
}

export function blockSummary(block: MmBlock | MmColumnBlock): string {
    switch (block.type) {
    case 'text': {
        const preview = block.text.replace(/\s+/g, ' ').trim();
        const truncated = preview.length > 40 ? `${preview.slice(0, 40)}…` : preview;
        return truncated || '(empty text)';
    }
    case 'button':
        return block.text || block.action_id;
    case 'static_select':
        return block.placeholder || block.action_id;
    case 'image':
        return block.alt_text || block.url;
    case 'container':
        return `${block.content.length} item${block.content.length === 1 ? '' : 's'}`;
    case 'column':
        return `${block.items.length} item${block.items.length === 1 ? '' : 's'}`;
    case 'column_set':
        return `${block.columns.length} column${block.columns.length === 1 ? '' : 's'}`;
    case 'collapsible':
        return 'Collapsible section';
    case 'divider':
        return 'Horizontal rule';
    default:
        return 'Unknown block';
    }
}

const TEXT_SIZE_OPTIONS: MmTextSize[] = ['small', 'default'];
const BUTTON_STYLE_OPTIONS: MmButtonStyle[] = ['default', 'primary', 'danger', 'good', 'success', 'warning'];
const IMAGE_SIZE_OPTIONS: MmImageSize[] = ['auto', 'xsmall', 'small', 'medium', 'large', 'stretch'];
const CONTAINER_GAP_OPTIONS: MmContainerGap[] = ['none', 'small', 'medium', 'large', 'xlarge'];
const CONTAINER_BACKGROUND_OPTIONS: MmContainerBackground[] = ['none', 'gray'];
const CONTAINER_MAX_HEIGHT_OPTIONS: MmContainerMaxHeight[] = ['none', 'small', 'medium', 'large'];

export function propertyFieldsForBlock(block: MmBlock | MmColumnBlock): PropertyField[] {
    switch (block.type) {
    case 'text':
        return [
            {key: 'text', label: 'text', type: 'string', placeholder: 'Markdown text'},
            {key: 'is_subtle', label: 'is_subtle', type: 'boolean'},
            {key: 'size', label: 'size', type: 'enum', options: TEXT_SIZE_OPTIONS},
        ];
    case 'divider':
        return [];
    case 'button':
        return [
            {key: 'text', label: 'text', type: 'string'},
            {key: 'action_id', label: 'action_id', type: 'string'},
            {key: 'style', label: 'style', type: 'enum', options: BUTTON_STYLE_OPTIONS},
            {key: 'tooltip', label: 'tooltip', type: 'string'},
            {key: 'disabled', label: 'disabled', type: 'boolean'},
            {key: 'query', label: 'query', type: 'json'},
            {key: 'cookie', label: 'cookie', type: 'string'},
        ];
    case 'static_select':
        return [
            {key: 'action_id', label: 'action_id', type: 'string'},
            {key: 'placeholder', label: 'placeholder', type: 'string'},
            {key: 'options', label: 'options', type: 'json'},
            {key: 'initial_option', label: 'initial_option', type: 'string'},
            {key: 'disabled', label: 'disabled', type: 'boolean'},
            {key: 'data_source', label: 'data_source', type: 'string'},
            {key: 'query', label: 'query', type: 'json'},
            {key: 'cookie', label: 'cookie', type: 'string'},
        ];
    case 'image':
        return [
            {key: 'url', label: 'url', type: 'string'},
            {key: 'alt_text', label: 'alt_text', type: 'string'},
            {key: 'title', label: 'title', type: 'string'},
            {key: 'size', label: 'size', type: 'enum', options: IMAGE_SIZE_OPTIONS},
            {key: 'max_width', label: 'max_width', type: 'number'},
            {key: 'max_height', label: 'max_height', type: 'number'},
            {key: 'image_style', label: 'image_style', type: 'enum', options: ['default', 'person']},
            {key: 'horizontal_alignment', label: 'horizontal_alignment', type: 'enum', options: ['left', 'center', 'right']},
        ];
    case 'column':
        return [
            {key: 'width', label: 'width', type: 'enum', options: ['auto', 'stretch']},
            {key: 'gap', label: 'gap', type: 'enum', options: CONTAINER_GAP_OPTIONS},
        ];
    case 'container':
        return [
            {key: 'border', label: 'border', type: 'boolean'},
            {key: 'accent_color', label: 'accent_color', type: 'string', placeholder: 'Semantic or #hex'},
            {key: 'flow', label: 'flow', type: 'enum', options: ['horizontal', 'vertical']},
            {key: 'gap', label: 'gap', type: 'enum', options: CONTAINER_GAP_OPTIONS},
            {key: 'background', label: 'background', type: 'enum', options: CONTAINER_BACKGROUND_OPTIONS},
            {key: 'max_height', label: 'max_height', type: 'enum', options: CONTAINER_MAX_HEIGHT_OPTIONS},
        ];
    case 'collapsible':
        return [
            {key: 'collapsed', label: 'collapsed', type: 'boolean'},
        ];
    case 'column_set':
        return [
            {key: 'gap', label: 'gap', type: 'enum', options: CONTAINER_GAP_OPTIONS},
        ];
    default:
        return [];
    }
}

export function getPropertyValue(block: MmBlock | MmColumnBlock, key: string): unknown {
    return (block as Record<string, unknown>)[key];
}

export function setPropertyValue(
    block: MmBlock | MmColumnBlock,
    key: string,
    raw: string,
    field: PropertyField,
): MmBlock | MmColumnBlock {
    const next = {...block} as Record<string, unknown>;

    if (field.type === 'boolean') {
        if (raw === '' || raw === 'false') {
            delete next[key];
        } else {
            next[key] = true;
        }
        return next as MmBlock | MmColumnBlock;
    }

    if (field.type === 'number') {
        if (raw.trim() === '') {
            delete next[key];
        } else {
            const num = Number(raw);
            if (Number.isFinite(num)) {
                next[key] = num;
            }
        }
        return next as MmBlock | MmColumnBlock;
    }

    if (field.type === 'enum') {
        if (raw === '') {
            delete next[key];
        } else {
            next[key] = raw;
        }
        return next as MmBlock | MmColumnBlock;
    }

    if (field.type === 'json') {
        if (raw.trim() === '') {
            delete next[key];
            return next as MmBlock | MmColumnBlock;
        }
        try {
            const parsed = JSON.parse(raw);
            if (key === 'options' && Array.isArray(parsed)) {
                next[key] = parsed as MmStaticSelectOption[];
            } else if (key === 'query' && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                next[key] = parsed as Record<string, string>;
            } else {
                next[key] = parsed;
            }
        } catch {
            return block;
        }
        return next as MmBlock | MmColumnBlock;
    }

    if (raw.trim() === '') {
        delete next[key];
    } else {
        next[key] = raw;
    }
    return next as MmBlock | MmColumnBlock;
}

export function formatPropertyValue(value: unknown, field: PropertyField): string {
    if (value === undefined || value === null) {
        return '';
    }
    if (field.type === 'boolean') {
        return value === true ? 'true' : '';
    }
    if (field.type === 'json') {
        return JSON.stringify(value, null, 2);
    }
    if (field.type === 'number') {
        return String(value);
    }
    return String(value);
}
