// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Block Renderer for the Interactive Messages framework.
//
// Consumes normalized `MmBlock[]` and maps each block type to its
// corresponding React component. Built on top of existing product components
// (Markdown, Button) to keep the implementation consistent and avoid duplication.
//
// Unknown block types are silently skipped. Blocks with missing required fields
// are skipped individually; sibling blocks continue to render normally.

import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import type {CSSProperties, KeyboardEvent, MouseEvent} from 'react';
import {useDispatch} from 'react-redux';

import type {UserAutocomplete} from '@mattermost/types/autocomplete';
import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {
    MmBlock,
    MmButtonBlock,
    MmButtonStyle,
    MmCollapsibleBlock,
    MmColumnBlock,
    MmColumnSetBlock,
    MmContainerBlock,
    MmImageBlock,
    MmImageSize,
    MmScrollableBlock,
    MmStaticSelectBlock,
    MmTextBlock,
} from '@mattermost/types/mm_blocks';
import type {PostImage} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {secureGetFromRecord} from 'mattermost-redux/utils/post_utils';

import {autocompleteChannels} from 'actions/channel_actions';
import {autocompleteUsers} from 'actions/user_actions';
import {openModal} from 'actions/views/modals';

import AutocompleteSelector from 'components/autocomplete_selector';
import type {Option, Selected} from 'components/autocomplete_selector';
import ExternalImage from 'components/external_image';
import FilePreviewModal from 'components/file_preview_modal';
import Markdown from 'components/markdown';
import PostContext from 'components/post_view/post_context';
import SizeAwareImage from 'components/size_aware_image';
import GenericChannelProvider from 'components/suggestion/generic_channel_provider';
import GenericUserProvider from 'components/suggestion/generic_user_provider';
import MenuActionProvider from 'components/suggestion/menu_action_provider';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';

import './block_renderer.scss';

// ---------------------------------------------------------------------------
// Action handler type – delegates to the existing action dispatch layer
// ---------------------------------------------------------------------------

/** Optional 4th arg is legacy attachment `cookie` when the block was translated from `props.attachments`. */
export type ActionHandler = (actionId: string, selectedOption?: string, query?: Record<string, string>, attachmentCookie?: string) => void;

const MmBlocksImagesMetadataContext = createContext<Record<string, PostImage> | undefined>(undefined);

/** Preset caps loosely aligned with Adaptive Cards `Image` sizes; `stretch` matches legacy attachment `image_url`. */
const MM_IMAGE_SIZE_CAPS: Record<MmImageSize, {maxWidth: number; maxHeight: number} | null> = {
    auto: null,
    small: {maxWidth: 80, maxHeight: 80},
    medium: {maxWidth: 200, maxHeight: 200},
    large: {maxWidth: 400, maxHeight: 400},
    stretch: {maxWidth: 500, maxHeight: 300},
};

function resolveMmImageCaps(block: MmImageBlock): {maxWidth?: number; maxHeight?: number} {
    const size = block.size ?? 'stretch';
    const preset = MM_IMAGE_SIZE_CAPS[size];
    const maxWidth = block.max_width ?? preset?.maxWidth;
    const maxHeight = block.max_height ?? preset?.maxHeight;
    if (size === 'auto' && block.max_width === undefined && block.max_height === undefined) {
        return {};
    }
    const out: {maxWidth?: number; maxHeight?: number} = {};
    if (maxWidth !== undefined) {
        out.maxWidth = maxWidth;
    }
    if (maxHeight !== undefined) {
        out.maxHeight = maxHeight;
    }
    return out;
}

const MM_IMAGE_ALIGN_JUSTIFY: Record<'left' | 'center' | 'right', NonNullable<CSSProperties['justifyContent']>> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
};

function mmBlocksButtonClassName(style: MmButtonStyle | undefined): string {
    const base = 'btn btn-sm';
    switch (style ?? 'default') {
    case 'primary':
        return `${base} btn-primary`;
    case 'danger':
        return `${base} btn-tertiary btn-danger`;
    default:
        return `${base} btn-tertiary`;
    }
}

// ---------------------------------------------------------------------------
// Root renderer
// ---------------------------------------------------------------------------

type BlockRendererProps = {
    blocks: MmBlock[];
    postId: string;
    onAction: ActionHandler;

    /** Optional `post.metadata.images` for dimension hints / SVG handling. */
    imagesMetadata?: Record<string, PostImage>;
};

export const BlockRenderer = ({blocks, postId, onAction, imagesMetadata}: BlockRendererProps) => {
    const metadataValue = useMemo(() => imagesMetadata, [imagesMetadata]);
    return (
        <MmBlocksImagesMetadataContext.Provider value={metadataValue}>
            <div
                className='mm-blocks'
                role='group'
                aria-label='Interactive message'
            >
                {blocks.map((block, i) => (
                    <BlockSwitch
                        key={i}
                        block={block}
                        postId={postId}
                        onAction={onAction}
                    />
                ))}
            </div>
        </MmBlocksImagesMetadataContext.Provider>
    );
};

// ---------------------------------------------------------------------------
// Block switch – routes each block to its component
// ---------------------------------------------------------------------------

type BlockSwitchProps = {
    block: MmBlock;
    postId: string;
    onAction: ActionHandler;
};

const BlockSwitch = ({block, postId, onAction}: BlockSwitchProps) => {
    switch (block.type) {
    case 'text':
        return (
            <TextBlock
                block={block}
                postId={postId}
                onAction={onAction}
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
        return (
            <hr
                className='mm-blocks-divider'
            />
        );
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
    case 'scrollable':
        return (
            <ScrollableBlock
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
                onAction={onAction}
            />
        );
    default:
        // Unknown block type – silently skip per spec
        return null;
    }
};

// ---------------------------------------------------------------------------
// Text block
// ---------------------------------------------------------------------------

type TextBlockProps = {block: MmTextBlock; postId: string; onAction: ActionHandler};

function mmTextBlockClassNames(block: MmTextBlock): string {
    const parts = ['mm-blocks-text'];
    if (block.is_subtle) {
        parts.push('mm-blocks-text--subtle');
    }
    if (block.size === 'small') {
        parts.push('mm-blocks-text--small');
    }
    return parts.join(' ');
}

const TextBlock = ({block, postId, onAction}: TextBlockProps) => {
    const handleMmActionMarkdown = useCallback(
        (actionId: string, query: Record<string, string>) => {
            onAction(actionId, undefined, query, undefined);
        },
        [onAction],
    );
    if (!block.text) {
        return null;
    }
    return (
        <div className={mmTextBlockClassNames(block)}>
            <Markdown
                message={block.text}
                postId={postId}
                onMmBlocksMarkdownAction={handleMmActionMarkdown}
            />
        </div>
    );
};

// ---------------------------------------------------------------------------
// Image block (Block Kit `image` + Adaptive Cards `Image`)
// ---------------------------------------------------------------------------

type ImageBlockProps = {
    block: MmImageBlock;
    postId: string;
};

const ImageBlock = ({block, postId}: ImageBlockProps) => {
    const dispatch = useDispatch();
    const imagesMetadata = useContext(MmBlocksImagesMetadataContext);
    const url = typeof block.url === 'string' ? block.url.trim() : '';
    const imageMetadata = secureGetFromRecord(imagesMetadata, url);
    const caps = resolveMmImageCaps(block);

    const showModal = useCallback((
        e: KeyboardEvent<HTMLImageElement> | MouseEvent<HTMLImageElement | HTMLDivElement>,
        link = '',
    ) => {
        const src = link || url;
        const index = src.lastIndexOf('.');
        const extension = index > 0 ? src.substring(index + 1) : '';

        e.preventDefault();

        dispatch(openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                startIndex: 0,
                postId,
                fileInfos: [{
                    has_preview_image: false,
                    link: src,
                    extension: imageMetadata?.format ?? extension,
                    name: block.alt_text || src,
                }],
            },
        }));
    }, [dispatch, postId, url, block.alt_text, imageMetadata?.format]);

    if (!url) {
        return null;
    }

    const imgClass = [
        'mm-blocks-image__img',
        block.image_style === 'person' ? 'mm-blocks-image__img--person' : '',
    ].filter(Boolean).join(' ');

    // Apply caps on the `<img>`: parent `max-height` does not limit replaced content, and
    // `SizeAwareImage`'s wrappers are `inline-block` so `max-width:100%` on the img can
    // resolve against an effectively unbounded containing width (intrinsic image width).
    const imageConstraintStyle: CSSProperties = {
        width: 'auto',
        height: 'auto',
        objectFit: block.image_style === 'person' ? 'cover' : 'contain',
    };
    if (caps.maxWidth !== undefined) {
        imageConstraintStyle.maxWidth = caps.maxWidth;
    }
    if (caps.maxHeight !== undefined) {
        imageConstraintStyle.maxHeight = caps.maxHeight;
    }

    const align = block.horizontal_alignment ?? 'left';
    const justifyContent = MM_IMAGE_ALIGN_JUSTIFY[align];

    return (
        <div
            className='mm-blocks-image'
            style={{display: 'flex', justifyContent}}
        >
            <div
                className='mm-blocks-image__frame'
                style={{
                    maxWidth: caps.maxWidth,
                    maxHeight: caps.maxHeight,
                }}
            >
                <ExternalImage
                    src={url}
                    imageMetadata={imageMetadata}
                >
                    {(safeSrc) => (
                        <SizeAwareImage
                            src={safeSrc}
                            dimensions={imageMetadata}
                            alt={block.alt_text}
                            title={block.title}
                            className={imgClass}
                            style={imageConstraintStyle}
                            onClick={showModal}
                            showLoader={true}
                            hideUtilities={true}
                        />
                    )}
                </ExternalImage>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Button element
// ---------------------------------------------------------------------------

type ButtonElementProps = {
    element: MmButtonBlock;
    onAction: ActionHandler;
};

const ButtonElement = ({element, onAction}: ButtonElementProps) => {
    const handleClick = useCallback(() => {
        if (!element.text) {
            return;
        }
        if (!element.action_id) {
            return;
        }
        onAction(element.action_id, undefined, element.query, element.cookie);
    }, [element.action_id, element.cookie, element.query, element.text, onAction]);

    if (!element.text || (!element.action_id)) {
        return null;
    }

    const button = (
        <button
            type='button'
            className={mmBlocksButtonClassName(element.style)}
            onClick={handleClick}
            disabled={element.disabled === true}
        >
            {element.text}
        </button>
    );

    return (
        <WithTooltip
            title={element.tooltip ?? ''}
            disabled={!element.tooltip}
        >
            {button}
        </WithTooltip>
    );
};

// ---------------------------------------------------------------------------
// Static select element (same UX as message attachment ActionMenu: AutocompleteSelector + providers;
// dispatches via block `onAction` instead of selectAttachmentMenuAction).
// ---------------------------------------------------------------------------

type MmBlocksSelectProvider = GenericUserProvider | GenericChannelProvider | MenuActionProvider;

type StaticSelectElementProps = {
    element: MmStaticSelectBlock;
    onAction: ActionHandler;
};

const StaticSelectElement = ({element, onAction}: StaticSelectElementProps) => {
    const dispatch = useDispatch();

    const wrapAutocompleteUsers = useCallback(
        (username: string) => dispatch(autocompleteUsers(username)) as Promise<UserAutocomplete>,
        [dispatch],
    );

    const wrapAutocompleteChannels = useCallback(
        (term: string, success: (channels: Channel[]) => void, error?: (err: ServerError) => void) => {
            return dispatch(autocompleteChannels(term, success, error));
        },
        [dispatch],
    );

    const providers = useMemo((): MmBlocksSelectProvider[] => {
        if (element.data_source === 'users') {
            return [new GenericUserProvider(wrapAutocompleteUsers)];
        }
        if (element.data_source === 'channels') {
            return [new GenericChannelProvider(wrapAutocompleteChannels)];
        }
        const opts = element.options ?? [];
        if (opts.length > 0) {
            return [new MenuActionProvider(opts)];
        }
        return [];
    }, [element.data_source, element.options, wrapAutocompleteUsers, wrapAutocompleteChannels]);

    const [value, setValue] = useState(() => {
        const opts = element.options ?? [];
        if (element.initial_option) {
            const sel = opts.find((o) => o.value === element.initial_option);
            return sel ? sel.text : '';
        }
        return '';
    });

    const handleSelected = useCallback(
        (selected: Selected) => {
            if (!selected || !element.action_id) {
                return;
            }

            let selectedOption = '';
            let text = '';
            if (element.data_source === 'users') {
                const user = selected as UserProfile;
                text = user.username;
                selectedOption = user.id;
            } else if (element.data_source === 'channels') {
                const channel = selected as Channel;
                text = channel.display_name;
                selectedOption = channel.id;
            } else {
                const option = selected as Option;
                text = option.text;
                selectedOption = option.value;
            }

            onAction(element.action_id, selectedOption, element.query, element.cookie);
            setValue(text);
        },
        [element.action_id, element.cookie, element.data_source, element.query, onAction],
    );

    const isDynamicSource = element.data_source === 'users' || element.data_source === 'channels';
    const optionCount = element.options?.length ?? 0;
    const isValid = Boolean(element.action_id && (isDynamicSource || optionCount > 0) && providers.length > 0);

    if (!isValid) {
        return null;
    }

    return (
        <PostContext.Consumer>
            {({handlePopupOpened}) => (
                <AutocompleteSelector
                    providers={providers}
                    onSelected={handleSelected}
                    placeholder={element.placeholder}
                    inputClassName='post-attachment-dropdown'
                    value={value}
                    toggleFocus={handlePopupOpened}
                    disabled={element.disabled === true}
                />
            )}
        </PostContext.Consumer>
    );
};

// ---------------------------------------------------------------------------
// Column set block
// ---------------------------------------------------------------------------

type ColumnSetBlockProps = {
    block: MmColumnSetBlock;
    postId: string;
    onAction: ActionHandler;
};

const ColumnSetBlock = ({block, postId, onAction}: ColumnSetBlockProps) => {
    if (!block.columns || block.columns.length === 0) {
        return null;
    }
    return (
        <div
            role='group'
            className='mm-blocks-column-set'
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

// ---------------------------------------------------------------------------
// Column block
// ---------------------------------------------------------------------------

type ColumnBlockProps = {
    block: MmColumnBlock;
    postId: string;
    onAction: ActionHandler;
};

const ColumnBlock = ({block, postId, onAction}: ColumnBlockProps) => {
    if (!block.items || block.items.length === 0) {
        return null;
    }
    const widthClass = block.width === 'stretch' ? 'mm-blocks-column--stretch' : 'mm-blocks-column--auto';
    return (
        <div className={`mm-blocks-column ${widthClass}`}>
            {block.items.map((item, i) => (
                <BlockSwitch
                    key={i}
                    block={item}
                    postId={postId}
                    onAction={onAction}
                />
            ))}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Container block
// ---------------------------------------------------------------------------

type ContainerBlockProps = {
    block: MmContainerBlock;
    postId: string;
    onAction: ActionHandler;
};

const NAMED_ATTACHMENT_ACCENT_SET = new Set(['good', 'warning', 'danger']);

/** Pixels for CSS `gap` between container children. `none` uses 0. */
const MM_CONTAINER_GAP_PX: Record<'small' | 'medium' | 'big', number> = {
    small: 4,
    medium: 8,
    big: 16,
};

function mmContainerGapStyle(gap: MmContainerBlock['gap'] | undefined): CSSProperties {
    const g = gap ?? 'none';
    if (g === 'none') {
        return {gap: 0};
    }
    return {gap: MM_CONTAINER_GAP_PX[g]};
}

const ContainerBlock = ({block, postId, onAction}: ContainerBlockProps) => {
    if (!block.content || block.content.length === 0) {
        return null;
    }
    let flowClass = '';
    if (block.flow === 'horizontal') {
        flowClass = 'mm-blocks-container--flow-horizontal';
    } else {
        flowClass = 'mm-blocks-container--flow-vertical';
    }
    const accent = block.accent_color;
    const gapStyle = mmContainerGapStyle(block.gap);
    if (!accent) {
        const className = [
            'mm-blocks-container',
            block.border ? 'mm-blocks-container--border' : '',
            flowClass,
        ].filter(Boolean).join(' ');

        return (
            <div
                className={className}
                style={gapStyle}
            >
                {block.content.map((item, i) => (
                    <BlockSwitch
                        key={i}
                        block={item}
                        postId={postId}
                        onAction={onAction}
                    />
                ))}
            </div>
        );
    }

    const isNamedAttachmentAccent = NAMED_ATTACHMENT_ACCENT_SET.has(accent);
    const accentInlineStyle = isNamedAttachmentAccent ? undefined : {borderLeftColor: accent} as React.CSSProperties;
    const namedAccentModifier = isNamedAttachmentAccent ? `attachment__container--${accent}` : '';
    const innerClasses = [
        'mm-blocks-container',
        'attachment__container',
        namedAccentModifier,
        flowClass,
    ].filter(Boolean).join(' ');

    const innerStyle: CSSProperties = {...gapStyle, ...accentInlineStyle};

    const inner = (
        <div
            className={innerClasses}
            style={innerStyle}
        >
            {block.content.map((item, i) => (
                <BlockSwitch
                    key={i}
                    block={item}
                    postId={postId}
                    onAction={onAction}
                />
            ))}
        </div>
    );

    // Legacy attachment chrome: `.attachment__content` + inner `.attachment__container` (4px left bar).
    if (block.border) {
        return (
            <div className='mm-blocks__attachment-content'>
                {inner}
            </div>
        );
    }

    return inner;
};

// ---------------------------------------------------------------------------
// Collapsible block
// ---------------------------------------------------------------------------

type CollapsibleBlockProps = {
    block: MmCollapsibleBlock;
    postId: string;
    onAction: ActionHandler;
};

const CollapsibleBlock = ({block, postId, onAction}: CollapsibleBlockProps) => {
    const [collapsed, setCollapsed] = useState<boolean>(block.collapsed !== false);
    const toggleCollapsed = useCallback(() => {
        setCollapsed((prev) => !prev);
    }, []);

    if (!block.header || block.header.length === 0 || !block.content || block.content.length === 0) {
        return null;
    }

    const contentId = `mm-blocks-collapsible-content-${postId}`;

    return (
        <div className='mm-blocks-collapsible'>
            <button
                className='mm-blocks-collapsible-header style--none'
                onClick={toggleCollapsed}
                aria-expanded={!collapsed}
                aria-controls={contentId}
            >
                {block.header.map((item, i) => (
                    <BlockSwitch
                        key={i}
                        block={item}
                        postId={postId}
                        onAction={onAction}
                    />
                ))}
            </button>
            {!collapsed && (
                <div
                    id={contentId}
                    className='mm-blocks-collapsible-content'
                >
                    {block.content.map((item, i) => (
                        <BlockSwitch
                            key={i}
                            block={item}
                            postId={postId}
                            onAction={onAction}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Scrollable block
// ---------------------------------------------------------------------------

/** Fixed scroll viewport heights (px) for MmScrollableBlock.height presets. */
const MM_SCROLLABLE_HEIGHT_PX: Record<'small' | 'medium' | 'large', number> = {
    small: 160,
    medium: 280,
    large: 420,
};

function mmScrollableHeightPx(height: MmScrollableBlock['height'] | undefined): number {
    const key = height === 'small' || height === 'medium' || height === 'large' ? height : 'medium';
    return MM_SCROLLABLE_HEIGHT_PX[key];
}

type ScrollableBlockProps = {
    block: MmScrollableBlock;
    postId: string;
    onAction: ActionHandler;
};

const ScrollableBlock = ({block, postId, onAction}: ScrollableBlockProps) => {
    if (!block.content || block.content.length === 0) {
        return null;
    }

    const h = mmScrollableHeightPx(block.height);

    return (
        <div
            role='region'
            aria-label='Scrollable content'
            className='mm-blocks-scrollable'
            style={{maxHeight: h, overflowY: 'auto'}}
        >
            {block.content.map((item, i) => (
                <BlockSwitch
                    key={i}
                    block={item}
                    postId={postId}
                    onAction={onAction}
                />
            ))}
        </div>
    );
};
