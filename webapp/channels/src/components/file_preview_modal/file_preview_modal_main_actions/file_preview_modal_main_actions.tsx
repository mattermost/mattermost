// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {FileInfo} from '@mattermost/types/files';

import {getFilePublicLink} from 'mattermost-redux/actions/files';
import {getFilePublicLink as selectFilePublicLink} from 'mattermost-redux/selectors/entities/files';

import CopyButton from 'components/copy_button';
import ExternalLink from 'components/external_link';
import WithTooltip from 'components/with_tooltip';

import {FileTypes} from 'utils/constants';
import {copyToClipboard, getFileType} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {isFileInfo} from '../types';
import type {LinkInfo} from '../types';

import './file_preview_modal_main_actions.scss';

const COPIED_TOOLTIP_DURATION = 2000;

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
}

const FilePreviewModalMainActions: React.FC<Props> = (props: Props) => {
    const intl = useIntl();

    const selectedFilePublicLink = useSelector((state: GlobalState) => selectFilePublicLink(state)?.link);
    const dispatch = useDispatch();
    const [publicLinkCopied, setPublicLinkCopied] = useState(false);

    useEffect(() => {
        if (isFileInfo(props.fileInfo) && props.enablePublicLink) {
            dispatch(getFilePublicLink(props.fileInfo.id));
        }
    }, [props.fileInfo, props.enablePublicLink]);

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
            key='publicLink'
        >
            <button
                className='file-preview-modal-main-actions__action-item'
                onClick={props.handleModalClose}
                aria-label={closeMessage}
            >
                <i className='icon icon-close'/>
            </button>
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
            <a
                href='#'
                className='file-preview-modal-main-actions__action-item'
                onClick={copyPublicLink}
                aria-label={publicTooltipMessage}
            >
                <i className='icon icon-link-variant'/>
            </a>
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
            <ExternalLink
                href={props.fileURL}
                className='file-preview-modal-main-actions__action-item'
                location='file_preview_modal_main_actions'
                download={props.filename}
                aria-label={downloadMessage}
            >
                <i className='icon icon-download-outline'/>
            </ExternalLink>
        </WithTooltip>
    );

    const copy = (
        <CopyButton
            className='file-preview-modal-main-actions__action-item'
            isForText={getFileType(props.fileInfo.extension) === FileTypes.TEXT}
            content={props.content}
        />
    );
    return (
        <div className='file-preview-modal-main-actions__actions'>
            {!props.showOnlyClose && props.canCopyContent && copy}
            {!props.showOnlyClose && props.enablePublicLink && props.showPublicLink && publicLink}
            {!props.showOnlyClose && props.canDownloadFiles && download}
            {props.showClose && closeButton}
        </div>
    );
};

FilePreviewModalMainActions.defaultProps = {
    showOnlyClose: false,
    showClose: true,
    showPublicLink: true,
};

export default memo(FilePreviewModalMainActions);
