// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import CloseIcon from '@mattermost/compass-icons/components/close';
import DownloadOutlineIcon from '@mattermost/compass-icons/components/download-outline';
import LinkVariantIcon from '@mattermost/compass-icons/components/link-variant';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {FileInfo} from '@mattermost/types/files';

import {getFilePublicLink} from 'mattermost-redux/actions/files';
import {getFilePublicLink as selectFilePublicLink} from 'mattermost-redux/selectors/entities/files';

import CopyButton from 'components/copy_button';
import ExternalLink from 'components/external_link';
import MarkdownViewToggle from 'components/markdown_view_toggle/markdown_view_toggle';

import {FileTypes, MarkdownViews} from 'utils/constants';
import type {MarkdownView} from 'utils/constants';
import {copyToClipboard, getFileType} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {isFileInfo} from '../types';
import type {LinkInfo} from '../types';

import './file_preview_modal_main_actions.scss';

const COPIED_TOOLTIP_DURATION = 2000;

const iconButtonProps = {size: 'medium', style: 'inverted'} as const;

interface Props {
    showOnlyClose?: boolean;
    showClose?: boolean;
    showPublicLink?: boolean;
    filename: string;
    fileURL: string;
    fileInfo: FileInfo | LinkInfo;
    enablePublicLink: boolean;
    canDownloadFiles: boolean;
    canCopyContent: boolean;
    handleModalClose: () => void;
    content: string;
    showMarkdownToggle?: boolean;
    markdownView?: MarkdownView;
    onMarkdownViewChange?: (view: MarkdownView) => void;
}

const FilePreviewModalMainActions: React.FC<Props> = ({
    showOnlyClose = false,
    showClose = true,
    showPublicLink = true,
    filename,
    fileURL,
    fileInfo,
    enablePublicLink,
    canDownloadFiles,
    canCopyContent,
    handleModalClose,
    content,
    showMarkdownToggle = false,
    markdownView = MarkdownViews.RENDERED,
    onMarkdownViewChange,
}: Props) => {
    const intl = useIntl();

    const selectedFilePublicLink = useSelector((state: GlobalState) => selectFilePublicLink(state)?.link);
    const dispatch = useDispatch();
    const [publicLinkCopied, setPublicLinkCopied] = useState(false);

    useEffect(() => {
        if (isFileInfo(fileInfo) && enablePublicLink) {
            dispatch(getFilePublicLink(fileInfo.id));
        }
    }, [fileInfo, enablePublicLink]);

    useEffect(() => {
        if (publicLinkCopied) {
            setTimeout(() => {
                setPublicLinkCopied(false);
            }, COPIED_TOOLTIP_DURATION);
        }
    }, [publicLinkCopied]);

    const copyPublicLink = () => {
        copyToClipboard(selectedFilePublicLink ?? '');
        setPublicLinkCopied(true);
    };

    const closeMessage = intl.formatMessage({
        id: 'full_screen_modal.close',
        defaultMessage: 'Close',
    });
    const closeButton = (
        <WithTooltip
            title={closeMessage}
            key='close'
        >
            <IconButton
                {...iconButtonProps}
                icon={<Icon glyph={<CloseIcon/>}/>}
                onClick={handleModalClose}
                aria-label={closeMessage}
            />
        </WithTooltip>
    );

    let publicTooltipMessage;
    if (publicLinkCopied) {
        publicTooltipMessage = intl.formatMessage({
            id: 'file_preview_modal_main_actions.public_link-copied',
            defaultMessage: 'Public link copied',
        });
    } else {
        publicTooltipMessage = intl.formatMessage({
            id: 'view_image_popover.publicLink',
            defaultMessage: 'Get a public link',
        });
    }
    const publicLink = (
        <WithTooltip
            key='filePreviewPublicLink'
            title={publicTooltipMessage}
        >
            <IconButton
                {...iconButtonProps}
                icon={<Icon glyph={<LinkVariantIcon/>}/>}
                onClick={copyPublicLink}
                aria-label={publicTooltipMessage}
            />
        </WithTooltip>
    );

    const downloadMessage = intl.formatMessage({
        id: 'view_image_popover.download',
        defaultMessage: 'Download',
    });
    const download = (
        <WithTooltip
            key='download'
            title={downloadMessage}
        >
            <IconButton
                {...iconButtonProps}
                asChild={true}
                icon={<Icon glyph={<DownloadOutlineIcon/>}/>}
                aria-label={downloadMessage}
            >
                <ExternalLink
                    href={fileURL}
                    location='file_preview_modal_main_actions'
                    download={filename}
                >
                    {null}
                </ExternalLink>
            </IconButton>
        </WithTooltip>
    );

    const copy = (
        <CopyButton
            iconButtonProps={iconButtonProps}
            isForText={getFileType(fileInfo.extension) === FileTypes.TEXT}
            content={content}
        />
    );

    const markdownToggle = onMarkdownViewChange && (
        <MarkdownViewToggle
            key='markdownToggle'
            appearance='onDark'
            view={markdownView}
            onChange={onMarkdownViewChange}
        />
    );

    return (
        <div className='file-preview-modal-main-actions__actions'>
            {!showOnlyClose && showMarkdownToggle && markdownToggle}
            {!showOnlyClose && canCopyContent && copy}
            {!showOnlyClose && enablePublicLink && showPublicLink && publicLink}
            {!showOnlyClose && canDownloadFiles && download}
            {showClose && closeButton}
        </div>
    );
};

export default memo(FilePreviewModalMainActions);
