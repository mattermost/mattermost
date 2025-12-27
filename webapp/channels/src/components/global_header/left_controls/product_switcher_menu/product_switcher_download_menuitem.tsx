// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {DownloadOutlineIcon} from '@mattermost/compass-icons/components';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import * as Menu from 'components/menu';

import {makeUrlSafe} from 'utils/url';

export default function ProductSwitcherDownloadMenuItem() {
    const config = useSelector(getConfig);
    const appDownloadLink = config.AppDownloadLink;

    const safeAppDownloadLink = useMemo(() => {
        if (!appDownloadLink) {
            return '';
        }

        return makeUrlSafe(appDownloadLink);
    }, [appDownloadLink]);

    if (!safeAppDownloadLink) {
        return null;
    }

    function handleClick() {
        window.open(safeAppDownloadLink, '_blank', 'noopener,noreferrer');
    }

    return (
        <Menu.Item
            leadingElement={<DownloadOutlineIcon size={18}/>}
            labels={
                <FormattedMessage
                    id='productSwitcherMenu.downloadApps.label'
                    defaultMessage='Download Apps'
                />
            }
            onClick={handleClick}
        />
    );
}

