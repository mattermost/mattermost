// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {NodeViewProps} from '@tiptap/react';
import {NodeViewWrapper} from '@tiptap/react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import './image_placeholder_node_view.scss';

type ImagePlaceholderNodeViewProps = NodeViewProps;

const ImagePlaceholderNodeView = ({node}: ImagePlaceholderNodeViewProps) => {
    const {width, height, fileName, isVideo} = node.attrs;

    return (
        <NodeViewWrapper
            as='div'
            className='wiki-image-placeholder-wrapper'
            data-image-placeholder=''
        >
            <div
                className='wiki-image-placeholder'
                style={{
                    width: '100%',
                    maxWidth: width,
                    aspectRatio: `${width} / ${height}`,
                }}
            >
                <div className='wiki-image-placeholder__content'>
                    <i className='icon icon-loading icon-spin'/>
                    <span className='wiki-image-placeholder__text'>
                        {isVideo ? (
                            <FormattedMessage
                                id='wiki.image_placeholder.uploading_video'
                                defaultMessage='Uploading video...'
                            />
                        ) : (
                            <FormattedMessage
                                id='wiki.image_placeholder.uploading_image'
                                defaultMessage='Uploading image...'
                            />
                        )}
                    </span>
                    {fileName && (
                        <span
                            className='wiki-image-placeholder__filename'
                            title={fileName}
                        >
                            {fileName}
                        </span>
                    )}
                </div>
            </div>
        </NodeViewWrapper>
    );
};

export default ImagePlaceholderNodeView;
