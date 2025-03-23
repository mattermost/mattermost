// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

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
}

export default class FilenameOverlay extends React.PureComponent<Props> {
    render() {
        const {
            canDownload,
            children,
            compactDisplay,
            fileInfo,
            handleImageClick,
            iconClass,
        } = this.props;

        const fileName = fileInfo.name;
        const trimmedFilename = trimFilename(fileName);

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
            filenameOverlay = (
                <div className={iconClass || 'post-image__name'}>
                    <WithTooltip
                        title={defineMessage({id: 'view_image_popover.download', defaultMessage: 'Download'})}
                    >
                        <ExternalLink
                            href={getFileDownloadUrl(fileInfo.id)}
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
        } else {
            filenameOverlay = (
                <span className='post-image__name'>
                    {trimmedFilename}
                </span>
            );
        }

        return (filenameOverlay);
    }
}
