// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {defineMessage, useIntl} from 'react-intl';

import type {FileInfo} from '@mattermost/types/files';

import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import ExternalLink from 'components/external_link';
import AttachmentIcon from 'components/widgets/icons/attachment_icon';
import WithTooltip from 'components/with_tooltip';

import {trimFilename} from 'utils/file_utils';
import {localizeMessage} from 'utils/utils';

type Props = {

    /*
     * File detailed information
     */
    fileInfo: FileInfo;

    /*
     * Handler for when the thumbnail is clicked passed the index above
     */
    handleImageClick?: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;

    /*
     * Display in compact format
     */
    compactDisplay?: boolean;

    /*
     * If it should display link to download on file name
     */
    canDownload?: boolean;

    /*
     * Optional children like download icon
     */
    children?: React.ReactNode;

    /*
     * Optional class like for icon
     */
    iconClass?: string;

    overrideGenerateFileDownloadUrl?: (fileId: string) => string;

    /*
     * For encrypted files: the decrypted blob URL to download from (mattermost-extended)
     */
    decryptedBlobUrl?: string;

    /*
     * For encrypted files: the original filename to use for download (mattermost-extended)
     */
    decryptedFileName?: string;
}

export default function FilenameOverlay(props: Props) {
    const {
        canDownload,
        children,
        compactDisplay,
        fileInfo,
        handleImageClick,
        iconClass,
        overrideGenerateFileDownloadUrl,
        decryptedBlobUrl,
        decryptedFileName,
    } = props;

    const {formatMessage} = useIntl();
    const [isDownloading, setIsDownloading] = useState(false);

    // Use decrypted filename if available, otherwise use server filename
    const fileName = decryptedFileName || fileInfo.name;
    const trimmedFilename = trimFilename(fileName);

    // Helper function to trigger a download with a blob URL
    const downloadBlobUrl = useCallback((blobUrl: string, downloadFilename: string) => {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = downloadFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    // Handle encrypted file download
    const handleEncryptedDownload = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isDownloading || !decryptedBlobUrl) {
            return;
        }

        setIsDownloading(true);
        try {
            downloadBlobUrl(decryptedBlobUrl, fileName);
        } finally {
            setIsDownloading(false);
        }
    }, [isDownloading, decryptedBlobUrl, fileName, downloadBlobUrl]);

    let filenameOverlay;
    if (compactDisplay) {
        filenameOverlay = (
            <WithTooltip
                title={fileName}
            >
                <a
                    href='#'
                    onClick={handleImageClick}
                    className='post-image__name btn btn-icon btn-sm'
                    rel='noopener noreferrer'
                >
                    <AttachmentIcon className='icon'/>
                    {trimmedFilename}
                </a>
            </WithTooltip>
        );
    } else if (canDownload) {
        // For encrypted files with decrypted blob URL, use a button that triggers programmatic download
        if (decryptedBlobUrl) {
            const downloadMessage = formatMessage({id: 'view_image_popover.download', defaultMessage: 'Download'});
            filenameOverlay = (
                <div className={iconClass || 'post-image__name'}>
                    <WithTooltip
                        title={defineMessage({id: 'view_image_popover.download', defaultMessage: 'Download'})}
                    >
                        <button
                            onClick={handleEncryptedDownload}
                            disabled={isDownloading}
                            aria-label={downloadMessage.toLowerCase()}
                            className='btn btn-icon btn-sm'
                        >
                            {children || trimmedFilename}
                        </button>
                    </WithTooltip>
                </div>
            );
        } else {
            // Regular file download via link
            filenameOverlay = (
                <div className={iconClass || 'post-image__name'}>
                    <WithTooltip
                        title={defineMessage({id: 'view_image_popover.download', defaultMessage: 'Download'})}
                    >
                        <ExternalLink
                            href={(overrideGenerateFileDownloadUrl || getFileDownloadUrl)(fileInfo.id)}
                            aria-label={localizeMessage({id: 'view_image_popover.download', defaultMessage: 'Download'}).toLowerCase()}
                            className='btn btn-icon btn-sm'
                            download={fileName}
                            location='filename_overlay'
                        >
                            {children || trimmedFilename}
                        </ExternalLink>
                    </WithTooltip>
                </div>
            );
        }
    } else {
        filenameOverlay = (
            <span className='post-image__name'>
                {trimmedFilename}
            </span>
        );
    }

    return filenameOverlay;
}
