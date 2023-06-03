// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import './markdown_image_expand.scss';

export type Props = {
    alt: string;
    imageKey: string;
    children: React.ReactNode;
    isExpanded: boolean;
    postId: string;
    onToggle?: (isExpanded: boolean) => void;
    actions: {
        toggleInlineImageVisibility?: (postId: string, imageKey: string) => void;
    };
};

const MarkdownImageExpand: React.FC<Props> = ({children, alt, isExpanded, postId, actions, onToggle, imageKey}: Props) => {
    const {toggleInlineImageVisibility} = actions;

    useEffect(() => {
        onToggle?.(isExpanded);
    }, [isExpanded]);

    const handleToggleButtonClick = () => {
        if (toggleInlineImageVisibility) {
            toggleInlineImageVisibility(postId, imageKey);
        }
    };

    const wrapperClassName = `markdown-image-expand ${isExpanded ? 'markdown-image-expand--expanded' : ''}`;

    return (
        <div className={wrapperClassName}>
            {
                isExpanded &&
                <>
                    <button
                        className='markdown-image-expand__collapse-button'
                        type='button'
                        onClick={handleToggleButtonClick}
                    >
                        <span className='icon icon-menu-down'/>
                    </button>
                    {children}
                </>
            }

            {
                !isExpanded &&
                <button
                    className='markdown-image-expand__expand-button'
                    type='button'
                    onClick={handleToggleButtonClick}
                >
                    <span className='icon icon-menu-right markdown-image-expand__expand-icon'/>

                    <span className='markdown-image-expand__alt-text'>
                        {alt}
                    </span>
                </button>
            }
        </div>
    );
};

export default MarkdownImageExpand;
