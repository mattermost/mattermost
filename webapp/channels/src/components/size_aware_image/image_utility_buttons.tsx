// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import {DownloadOutlineIcon, LinkVariantIcon, CheckIcon} from '@mattermost/compass-icons/components';

import WithTooltip from '../with_tooltip';

const MIN_IMAGE_SIZE_FOR_INTERNAL_BUTTONS = 100;

type Props = WrappedComponentProps & {
    enablePublicLink?: boolean;
    src: string;
    fileURL?: string;
    handleSmallImageContainer?: boolean;
    isSmallImage: boolean;
    linkCopiedRecently: boolean;
    imageWidth: number;
    isInternalImage: boolean;
    onCopyLink: () => void;
};

function ImageUtilityButtons({
    enablePublicLink,
    intl,
    src,
    fileURL,
    handleSmallImageContainer,
    isSmallImage,
    linkCopiedRecently,
    imageWidth,
    isInternalImage,
    onCopyLink,
}: Props) {
    // Don't render utility buttons for external small images
    if (isSmallImage && !isInternalImage) {
        return null;
    }

    const copyLinkTooltipText = linkCopiedRecently ? (
        <FormattedMessage
            id={'single_image_view.copied_link_tooltip'}
            defaultMessage={'Copied'}
        />
    ) : (
        <FormattedMessage
            id={'single_image_view.copy_link_tooltip'}
            defaultMessage={'Copy link'}
        />
    );

    const copyLink = (
        <WithTooltip
            title={copyLinkTooltipText}
        >
            <button
                className={classNames('style--none', 'size-aware-image__copy_link', {
                    'size-aware-image__copy_link--recently_copied': linkCopiedRecently,
                })}
                aria-label={intl.formatMessage({id: 'single_image_view.copy_link_tooltip', defaultMessage: 'Copy link'})}
                onClick={onCopyLink}
            >
                {linkCopiedRecently ? (
                    <CheckIcon
                        className={'svg-check style--none'}
                        size={20}
                    />
                ) : (
                    <LinkVariantIcon
                        className={'style--none'}
                        size={20}
                    />
                )}
            </button>
        </WithTooltip>
    );

    const downloadTooltipText = (
        <FormattedMessage
            id='single_image_view.download_tooltip'
            defaultMessage='Download'
        />
    );

    const download = (
        <WithTooltip
            title={downloadTooltipText}
        >
            <a
                target='_blank'
                rel='noopener noreferrer'
                href={isInternalImage ? fileURL : src}
                className='style--none size-aware-image__download'
                download={true}
                role={isInternalImage ? 'button' : undefined}
                aria-label={intl.formatMessage({id: 'single_image_view.download_tooltip', defaultMessage: 'Download'})}
            >
                <DownloadOutlineIcon
                    className={'style--none'}
                    size={20}
                />
            </a>
        </WithTooltip>
    );

    // Determine which CSS classes to use based on image type and size
    const isSmallImageFlag = handleSmallImageContainer && isSmallImage;
    const hasSmallWidth = imageWidth < MIN_IMAGE_SIZE_FOR_INTERNAL_BUTTONS;

    const containerClasses = classNames('image-preview-utility-buttons-container', {
        'image-preview-utility-buttons-container--small-image': isSmallImageFlag || hasSmallWidth,
        'image-preview-utility-buttons-container--small-image-no-copy-button': (!enablePublicLink || !isInternalImage) && (isSmallImageFlag || hasSmallWidth),
    });

    // Determine which buttons to show
    const showCopyLink = (enablePublicLink || !isInternalImage);

    return (
        <span className={containerClasses}>
            {showCopyLink && copyLink}
            {download}
        </span>
    );
}

export default injectIntl(ImageUtilityButtons); 