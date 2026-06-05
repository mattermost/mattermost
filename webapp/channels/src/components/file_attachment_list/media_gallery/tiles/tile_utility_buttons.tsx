// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @mattermost/use-external-link */

import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import type {AnyAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';

import {CheckIcon, DownloadOutlineIcon, LinkVariantIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {FileInfo} from '@mattermost/types/files';

import {getFilePublicLink} from 'mattermost-redux/actions/files';
import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import {copyToClipboard} from 'utils/utils';

import type {GlobalState} from 'types/store';

type Props = {
    fileInfo: FileInfo;
    enablePublicLink: boolean;
};

const COPIED_TOOLTIP_MS = 1500;

const TileUtilityButtons = ({fileInfo, enablePublicLink}: Props) => {
    const intl = useIntl();
    const dispatch = useDispatch<ThunkDispatch<GlobalState, unknown, AnyAction>>();
    const [copied, setCopied] = useState(false);

    const stop = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
    }, []);

    const handleCopyLink = useCallback(async (e: React.MouseEvent) => {
        stop(e);
        try {
            const result = await dispatch(getFilePublicLink(fileInfo.id));
            const link = (result as {data?: {link?: string}}).data?.link;
            if (!link) {
                return;
            }
            copyToClipboard(link);
            setCopied(true);
            window.setTimeout(() => setCopied(false), COPIED_TOOLTIP_MS);
        } catch (err) {
            console.error('Failed to copy public file link', err); // eslint-disable-line no-console
        }
    }, [dispatch, fileInfo.id, stop]);

    const copyTooltip = copied ? (
        <FormattedMessage
            id='single_image_view.copied_link_tooltip'
            defaultMessage='Copied'
        />
    ) : (
        <FormattedMessage
            id='single_image_view.copy_link_tooltip'
            defaultMessage='Copy link'
        />
    );

    const downloadTooltip = (
        <FormattedMessage
            id='single_image_view.download_tooltip'
            defaultMessage='Download'
        />
    );

    return (
        <span
            className='image-preview-utility-buttons-container'
            onClick={stop}
            onKeyDown={stop}
            role='presentation'
        >
            {enablePublicLink && (
                <WithTooltip title={copyTooltip}>
                    <button
                        type='button'
                        className={classNames('style--none', 'size-aware-image__copy_link', {
                            'size-aware-image__copy_link--recently_copied': copied,
                        })}
                        aria-label={intl.formatMessage({id: 'single_image_view.copy_link_tooltip', defaultMessage: 'Copy link'})}
                        onClick={handleCopyLink}
                    >
                        {copied ? (
                            <CheckIcon
                                className='svg-check style--none'
                                size={20}
                            />
                        ) : (
                            <LinkVariantIcon
                                className='style--none'
                                size={20}
                            />
                        )}
                    </button>
                </WithTooltip>
            )}
            <WithTooltip title={downloadTooltip}>
                <a
                    target='_blank'
                    rel='noopener noreferrer'
                    href={getFileDownloadUrl(fileInfo.id)}
                    className='style--none size-aware-image__download'
                    download={true}
                    role='button'
                    aria-label={intl.formatMessage({id: 'single_image_view.download_tooltip', defaultMessage: 'Download'})}
                >
                    <DownloadOutlineIcon
                        className='style--none'
                        size={20}
                    />
                </a>
            </WithTooltip>
        </span>
    );
};

export default TileUtilityButtons;
