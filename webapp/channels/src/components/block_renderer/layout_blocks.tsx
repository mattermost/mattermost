// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import type {CSSProperties} from 'react';

import type {
    MmBlock,
    MmCollapsibleBlock,
    MmColumnBlock,
    MmColumnSetBlock,
    MmContainerAccentSemantic,
    MmContainerBlock,
    MmContainerGap,
} from '@mattermost/types/mm_blocks';

import {makeIsEligibleForClick} from 'utils/utils';

import {ButtonElement} from './button_element';
import {MmBlocksChildLayoutContext} from './context';
import {DividerBlock} from './divider_block';
import {ImageBlock} from './image_block';
import {StaticSelectElement} from './static_select_element';
import {TextBlock} from './text_block';
import type {ActionHandler} from './types';

type BlockSwitchProps = {
    block: MmBlock;
    postId: string;
    onAction: ActionHandler;
};

export const BlockSwitch = ({block, postId, onAction}: BlockSwitchProps) => {
    switch (block.type) {
    case 'text':
        return (
            <TextBlock
                block={block}
                postId={postId}
            />
        );
    case 'image':
        return (
            <ImageBlock
                block={block}
                postId={postId}
            />
        );
    case 'divider':
        return <DividerBlock/>;
    case 'column_set':
        return (
            <ColumnSetBlock
                block={block}
                postId={postId}
                onAction={onAction}
            />
        );
    case 'container':
        return (
            <ContainerBlock
                block={block}
                postId={postId}
                onAction={onAction}
            />
        );
    case 'collapsible':
        return (
            <CollapsibleBlock
                block={block}
                postId={postId}
                onAction={onAction}
            />
        );
    case 'button':
        return (
            <ButtonElement
                element={block}
                onAction={onAction}
            />
        );
    case 'static_select':
        return (
            <StaticSelectElement
                element={block}
                postId={postId}
                onAction={onAction}
            />
        );
    default:
        return null;
    }
};

type ColumnSetBlockProps = {
    block: MmColumnSetBlock;
    postId: string;
    onAction: ActionHandler;
};

function mmColumnSetClassName(block: MmColumnSetBlock): string {
    const gapKey = mmBlocksGapKey(block.gap);
    return classNames('mm-blocks-column-set', {
        'mm-blocks-column-set--gap-none': gapKey === 'none',
        'mm-blocks-column-set--gap-small': gapKey === 'small',
        'mm-blocks-column-set--gap-medium': gapKey === 'medium',
        'mm-blocks-column-set--gap-large': gapKey === 'large',
        'mm-blocks-column-set--gap-xlarge': gapKey === 'xlarge',
    });
}

const ColumnSetBlock = ({block, postId, onAction}: ColumnSetBlockProps) => {
    if (!block.columns || block.columns.length === 0) {
        return null;
    }

    // We use the index on the key since we don't have a unique id for the columns,
    // and we do not expect the number or order of columns to change.
    return (
        <div
            role='group'
            className={mmColumnSetClassName(block)}
        >
            {block.columns.map((column, i) => (
                <ColumnBlock
                    key={i}
                    block={column}
                    postId={postId}
                    onAction={onAction}
                />
            ))}
        </div>
    );
};

type ColumnBlockProps = {
    block: MmColumnBlock;
    postId: string;
    onAction: ActionHandler;
};

const ColumnBlock = ({block, postId, onAction}: ColumnBlockProps) => {
    const innerBlock = useMemo(() => ({
        type: 'container' as const,
        content: block.items,
        ...(block.gap ? {gap: block.gap} : {}),
    }), [block.items, block.gap]);

    if (!block.items || block.items.length === 0) {
        return null;
    }

    return (
        <div
            className={classNames('mm-blocks-column', {
                'mm-blocks-column--stretch': block.width === 'stretch',
                'mm-blocks-column--auto': block.width !== 'stretch',
            })}
        >
            <ContainerBlock
                block={innerBlock}
                postId={postId}
                onAction={onAction}
            />
        </div>
    );
};

type ContainerBlockProps = {
    block: MmContainerBlock;
    postId: string;
    onAction: ActionHandler;
};

const MM_CONTAINER_ACCENT_SEMANTIC = new Set<MmContainerAccentSemantic>([
    'default',
    'primary',
    'good',
    'warning',
    'danger',
]);

function isMmContainerSemanticAccent(accent: string): accent is MmContainerAccentSemantic {
    return MM_CONTAINER_ACCENT_SEMANTIC.has(accent as MmContainerAccentSemantic);
}

type MmBlocksGapKey = 'none' | 'small' | 'medium' | 'large' | 'xlarge';
type MmContainerMaxHeightKey = 'none' | 'small' | 'medium' | 'large';

function mmBlocksGapKey(gap: MmContainerGap | undefined): MmBlocksGapKey {
    if (gap === 'none' || gap === 'small' || gap === 'medium' || gap === 'large' || gap === 'xlarge') {
        return gap;
    }
    return 'medium';
}

function mmContainerMaxHeightKey(maxHeight: MmContainerBlock['max_height'] | undefined): MmContainerMaxHeightKey {
    if (maxHeight === 'none' || maxHeight === 'small' || maxHeight === 'medium' || maxHeight === 'large') {
        return maxHeight;
    }
    return 'none';
}

function mmContainerClassName(block: MmContainerBlock): string {
    const accent = block.accent_color;
    const isSemanticAccent = Boolean(accent && isMmContainerSemanticAccent(accent));
    const gapKey = mmBlocksGapKey(block.gap);
    const maxHeightKey = mmContainerMaxHeightKey(block.max_height);
    const flowKey = block.flow === 'horizontal' ? 'horizontal' : 'vertical';

    return classNames(
        'mm-blocks-container',
        `mm-blocks-container--flow-${flowKey}`,
        `mm-blocks-container--gap-${gapKey}`,
        `mm-blocks-container--max-height-${maxHeightKey}`,
        {
            'mm-blocks-container--accent': accent,
            [`mm-blocks-container--accent-${accent}`]: isSemanticAccent,
            'mm-blocks-container--accent-custom': Boolean(accent && !isSemanticAccent),
            'mm-blocks-container--border': !accent && block.border,
            'mm-blocks-container--accent-border': Boolean(accent && block.border),
            'mm-blocks-container--bg-gray': block.background === 'gray',
        },
    );
}

function mmContainerStyle(block: MmContainerBlock): CSSProperties | undefined {
    const accent = block.accent_color;
    if (!accent || isMmContainerSemanticAccent(accent)) {
        return undefined;
    }
    return {'--mm-blocks-accent-color': accent} as CSSProperties;
}

export const ContainerBlock = ({block, postId, onAction}: ContainerBlockProps) => {
    if (!block.content || block.content.length === 0) {
        return null;
    }
    const containerChildLayout: 'column' | 'row' = block.flow === 'horizontal' ? 'row' : 'column';
    const maxHeightKey = mmContainerMaxHeightKey(block.max_height);
    const regionProps = maxHeightKey === 'none' ? {} : {role: 'region' as const, 'aria-label': 'Scrollable content'};

    // We use the index on the key since we don't have a unique id for the content,
    // and we do not expect the number or order of content to change.
    return (
        <div
            className={mmContainerClassName(block)}
            style={mmContainerStyle(block)}
            {...regionProps}
        >
            <MmBlocksChildLayoutContext.Provider value={containerChildLayout}>
                {block.content.map((item, i) => (
                    <BlockSwitch
                        key={i}
                        block={item}
                        postId={postId}
                        onAction={onAction}
                    />
                ))}
            </MmBlocksChildLayoutContext.Provider>
        </div>
    );
};

type CollapsibleBlockProps = {
    block: MmCollapsibleBlock;
    postId: string;
    onAction: ActionHandler;
};

const MM_BLOCKS_COLLAPSIBLE_HEADER_INTERACTIVE_SELECTOR = [
    '.select-suggestion-container',
    '.mm-blocks-select',
    '.suggestion-list',
    '.mm-blocks-image',
    '.InlineActionButton',
].join(', ');

const isCollapsibleHeaderToggleClick = makeIsEligibleForClick(MM_BLOCKS_COLLAPSIBLE_HEADER_INTERACTIVE_SELECTOR);

const CollapsibleBlock = ({block, postId, onAction}: CollapsibleBlockProps) => {
    const initiallyCollapsed = block.collapsed !== false;
    const [collapsed, setCollapsed] = useState<boolean>(initiallyCollapsed);

    // null = expanded steady state (max-height: none); number pins height during animation.
    const [contentMaxHeight, setContentMaxHeight] = useState<number | null>(initiallyCollapsed ? 0 : null);
    const contentInnerRef = useRef<HTMLDivElement>(null);
    const toggleCollapsed = useCallback(() => {
        const inner = contentInnerRef.current;
        if (!inner) {
            setCollapsed((prev) => !prev);
            return;
        }

        if (!collapsed) {
            const height = inner.scrollHeight;
            setContentMaxHeight(height);
            requestAnimationFrame(() => {
                setContentMaxHeight(0);
                setCollapsed(true);
            });
            return;
        }

        setCollapsed(false);
        setContentMaxHeight(0);
        requestAnimationFrame(() => {
            setContentMaxHeight(inner.scrollHeight);
        });
    }, [collapsed]);
    const handleHeaderBodyClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!isCollapsibleHeaderToggleClick(e)) {
            return;
        }
        toggleCollapsed();
    }, [toggleCollapsed]);
    const handleContentTransitionEnd = useCallback((event: React.TransitionEvent<HTMLDivElement>) => {
        if (event.propertyName !== 'max-height' || event.target !== event.currentTarget) {
            return;
        }
        if (!collapsed) {
            setContentMaxHeight(null);
        }
    }, [collapsed]);
    const innerHeaderBlock = useMemo(() => ({
        type: 'container' as const,
        content: block.header,
    }), [block.header]);
    const innerContentBlock = useMemo(() => ({
        type: 'container' as const,
        content: block.content,
    }), [block.content]);

    if (!block.header || block.header.length === 0 || !block.content || block.content.length === 0) {
        return null;
    }

    const contentId = `mm-blocks-collapsible-content-${postId}`;

    const contentStyle: CSSProperties | undefined = contentMaxHeight === null ? undefined : {maxHeight: contentMaxHeight};

    return (
        <div
            className={classNames('mm-blocks-collapsible', {'mm-blocks-collapsible--expanded': !collapsed})}
            data-testid='mmBlocksCollapsible'
        >
            <div className='mm-blocks-collapsible-header'>
                <button
                    type='button'
                    className='mm-blocks-collapsible-header__toggle style--none'
                    data-testid='mmBlocksCollapsibleToggle'
                    onClick={toggleCollapsed}
                    aria-expanded={!collapsed}
                    aria-controls={contentId}
                >
                    <span
                        className='mm-blocks-collapsible-header__chevron'
                        aria-hidden='true'
                    >
                        <i className='icon icon-chevron-right'/>
                    </span>
                </button>
                {/* Chevron toggle is the keyboard-accessible control; body click expands/collapses for non-interactive header areas only. */}
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
                <div
                    className='mm-blocks-collapsible-header__body'
                    onClick={handleHeaderBodyClick}
                >
                    <ContainerBlock
                        block={innerHeaderBlock}
                        postId={postId}
                        onAction={onAction}
                    />
                </div>
            </div>
            <div
                id={contentId}
                className='mm-blocks-collapsible-content'
                data-testid='mmBlocksCollapsibleContent'
                aria-hidden={collapsed}
                style={contentStyle}
                onTransitionEnd={handleContentTransitionEnd}
            >
                <div
                    ref={contentInnerRef}
                    className='mm-blocks-collapsible-content__inner'
                >
                    <ContainerBlock
                        block={innerContentBlock}
                        postId={postId}
                        onAction={onAction}
                    />
                </div>
            </div>
        </div>
    );
};
