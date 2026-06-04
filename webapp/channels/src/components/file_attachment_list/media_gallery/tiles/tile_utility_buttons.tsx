// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import type {AnyAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';

import {CheckIcon, DownloadOutlineIcon, LinkVariantIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {FileInfo} from '@mattermost/types/files';

import {getFilePublicLink} from 'mattermost-redux/actions/files';
import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import ExternalLink from 'components/external_link';

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
        const result = await dispatch(getFilePublicLink(fileInfo.id));
        const link = (result as {data?: {link?: string}}).data?.link;
        if (!link) {
            return;
        }
        copyToClipboard(link);
        setCopied(true);
        window.setTimeout(() => setCopied(false), COPIED_TOOLTIP_MS);
    }, [dispatch, fileInfo.id, stop]);

    const copyTitle = copied ? intl.formatMessage({id: 'media_gallery.copied', defaultMessage: 'Copied'}) : intl.formatMessage({id: 'media_gallery.copy_link', defaultMessage: 'Copy link'});

    const downloadTitle = intl.formatMessage({id: 'media_gallery.download', defaultMessage: 'Download'});

    return (
        <span
            className='MediaGallery__tile__overlay'
            onClick={stop}
            onKeyDown={stop}
            role='presentation'
        >
            {enablePublicLink && (
                <WithTooltip title={copyTitle}>
                    <button
                        type='button'
                        className='style--none MediaGallery__tile__overlay_btn'
                        aria-label={copyTitle}
                        onClick={handleCopyLink}
                    >
                        {copied ? <CheckIcon size={18}/> : <LinkVariantIcon size={18}/>}
                    </button>
                </WithTooltip>
            )}
            <WithTooltip title={downloadTitle}>
                <ExternalLink
                    href={getFileDownloadUrl(fileInfo.id)}
                    className='style--none MediaGallery__tile__overlay_btn'
                    download={true}
                    aria-label={downloadTitle}
                    location='media_gallery_tile'
                >
                    <DownloadOutlineIcon size={18}/>
                </ExternalLink>
            </WithTooltip>
        </span>
    );
};

export default TileUtilityButtons;
