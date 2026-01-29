// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {EditorState} from '@tiptap/pm/state';
import {NodeSelection} from '@tiptap/pm/state';
import type {Editor} from '@tiptap/react';
import {BubbleMenu} from '@tiptap/react/menus';
import classNames from 'classnames';
import React, {useCallback, useMemo, useRef} from 'react';
import {useIntl} from 'react-intl';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';
import CreationOutlineIcon from '@mattermost/compass-icons/components/creation-outline';
import MessageTextOutlineIcon from '@mattermost/compass-icons/components/message-text-outline';
import PencilOutlineIcon from '@mattermost/compass-icons/components/pencil-outline';

import * as Menu from 'components/menu';
import WithTooltip from 'components/with_tooltip';

import './image_ai_bubble.scss';

export type ImageAIAction = 'extract_handwriting' | 'describe_image';

type Props = {
    editor: Editor | null;
    onImageAIAction?: (action: ImageAIAction, imageElement: HTMLImageElement) => void;
    visionEnabled?: boolean;
};

/**
 * Image AI Bubble Menu - appears when an image is selected in the editor.
 * Provides AI-powered image operations:
 * - Extract handwriting: OCR/vision to extract text from handwritten content
 * - Describe image: Generate a description of the image contents
 *
 * Note: These features require vision-capable AI models. When vision is not
 * available, this menu shows a disabled state with a tooltip explaining why.
 */
const ImageAIBubble = ({editor, onImageAIAction, visionEnabled = false}: Props) => {
    const {formatMessage} = useIntl();

    // Store the image element when menu item is clicked, before the delayed onClick fires
    // This is necessary because Menu.Item delays onClick until after menu close animation,
    // by which time the editor selection may have changed and getSelectedImageElement would return null
    const capturedImageRef = useRef<HTMLImageElement | null>(null);

    const shouldShow = useCallback(({state}: {editor: Editor; view: unknown; state: unknown; oldState: unknown; from: number; to: number}) => {
        // Guard: editor must be fully mounted before accessing view methods
        if (!editor || editor.isDestroyed) {
            return false;
        }

        const {selection} = state as EditorState;

        // Only show for NodeSelection (images are selected as nodes, not text)
        if (!(selection instanceof NodeSelection)) {
            capturedImageRef.current = null;
            return false;
        }

        // Check if the selected node is an image
        const {node} = selection;
        if (!node || (node.type.name !== 'image' && node.type.name !== 'imageResize')) {
            capturedImageRef.current = null;
            return false;
        }

        // Capture the image element now while it's selected
        // This is needed because Menu.Item delays onClick until after menu close animation,
        // by which time the selection may have changed
        try {
            if (editor?.view) {
                const pos = (selection as NodeSelection).from;
                const domNode = editor.view.nodeDOM(pos);

                if (domNode instanceof HTMLImageElement) {
                    capturedImageRef.current = domNode;
                } else if (domNode instanceof HTMLElement) {
                    const img = domNode.querySelector('img');
                    capturedImageRef.current = img;
                }
            }
        } catch {
            // View may not be fully mounted yet
        }

        return true;
    }, [editor]);

    const getSelectedImageElement = useCallback((): HTMLImageElement | null => {
        if (!editor || editor.isDestroyed || !editor.view) {
            return null;
        }

        try {
            const {selection} = editor.state;
            if (!(selection instanceof NodeSelection)) {
                return null;
            }

            // Get the DOM node for the selected image
            const pos = selection.from;
            const domNode = editor.view.nodeDOM(pos);

            if (domNode instanceof HTMLImageElement) {
                return domNode;
            }

            // For wrapped images (ImageResize), find the img element inside
            if (domNode instanceof HTMLElement) {
                const img = domNode.querySelector('img');
                if (img) {
                    return img;
                }
            }
        } catch {
            // View may not be fully mounted yet
        }

        return null;
    }, [editor]);

    const handleExtractHandwriting = useCallback(() => {
        // Use the captured image element from when the bubble menu was shown
        // This is necessary because this callback fires AFTER the menu close animation,
        // by which time the editor selection may have changed
        const imageElement = capturedImageRef.current || getSelectedImageElement();
        if (imageElement && onImageAIAction) {
            onImageAIAction('extract_handwriting', imageElement);
        }
    }, [getSelectedImageElement, onImageAIAction]);

    const handleDescribeImage = useCallback(() => {
        // Use the captured image element from when the bubble menu was shown
        const imageElement = capturedImageRef.current || getSelectedImageElement();
        if (imageElement && onImageAIAction) {
            onImageAIAction('describe_image', imageElement);
        }
    }, [getSelectedImageElement, onImageAIAction]);

    const menuConfig = useMemo(() => ({
        id: 'image-ai-bubble-menu',
        'aria-label': formatMessage({id: 'image_ai.menu_aria_label', defaultMessage: 'Image AI tools'}),
        width: '220px',
    }), [formatMessage]);

    const menuButtonConfig = useMemo(() => ({
        id: 'image-ai-bubble-button',
        dataTestId: 'image-ai-menu-button',
        'aria-label': formatMessage({id: 'image_ai.button_aria_label', defaultMessage: 'Image AI tools'}),
        disabled: !visionEnabled,
        class: classNames('image-ai-bubble-button', {disabled: !visionEnabled}),
        children: (
            <>
                <CreationOutlineIcon size={16}/>
                <span className='image-ai-bubble-button-text'>
                    {formatMessage({id: 'image_ai.button_label', defaultMessage: 'AI'})}
                </span>
                <ChevronDownIcon size={12}/>
            </>
        ),
    }), [formatMessage, visionEnabled]);

    const menuHeaderElement = useMemo(() => (
        <div className='image-ai-bubble-menu-header'>
            {formatMessage({id: 'image_ai.header', defaultMessage: 'IMAGE AI'})}
        </div>
    ), [formatMessage]);

    if (!editor) {
        return null;
    }

    const renderContent = (): JSX.Element => {
        if (!visionEnabled) {
            // Show disabled state with tooltip explaining why
            return (
                <div
                    className='image-ai-bubble-container'
                    data-testid='image-ai-bubble'
                >
                    <WithTooltip
                        title={formatMessage({
                            id: 'image_ai.vision_not_available',
                            defaultMessage: 'Vision AI is not available. Configure a vision-capable AI model to enable image analysis.',
                        })}
                    >
                        <button
                            type='button'
                            className='image-ai-bubble-button disabled'
                            disabled={true}
                            data-testid='image-ai-menu-button'
                        >
                            <CreationOutlineIcon size={16}/>
                            <span className='image-ai-bubble-button-text'>
                                {formatMessage({id: 'image_ai.button_label', defaultMessage: 'AI'})}
                            </span>
                            <ChevronDownIcon size={12}/>
                        </button>
                    </WithTooltip>
                </div>
            );
        }

        return (
            <div
                className='image-ai-bubble-container'
                data-testid='image-ai-bubble'
            >
                <Menu.Container
                    menu={menuConfig}
                    menuButton={menuButtonConfig}
                    menuHeader={menuHeaderElement}
                >
                    <Menu.Item
                        id='extract-handwriting'
                        data-testid='image-ai-extract-handwriting'
                        leadingElement={<PencilOutlineIcon size={18}/>}
                        labels={
                            <span>
                                {formatMessage({id: 'image_ai.extract_handwriting', defaultMessage: 'Extract handwriting'})}
                            </span>
                        }
                        onClick={handleExtractHandwriting}
                    />
                    <Menu.Item
                        id='describe-image'
                        data-testid='image-ai-describe-image'
                        leadingElement={<MessageTextOutlineIcon size={18}/>}
                        labels={
                            <span>
                                {formatMessage({id: 'image_ai.describe_image', defaultMessage: 'Describe image'})}
                            </span>
                        }
                        onClick={handleDescribeImage}
                    />
                </Menu.Container>
            </div>
        );
    };

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={shouldShow}
        >
            {renderContent()}
        </BubbleMenu>
    );
};

export default ImageAIBubble;
