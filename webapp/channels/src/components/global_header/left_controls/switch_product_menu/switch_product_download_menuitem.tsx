// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import {DownloadOutlineIcon} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';

import {makeUrlSafe} from 'utils/url';

type Props = {
    appDownloadLink?: string;
}

export default function ProductSwitcherDownloadMenuItem(props: Props) {
    const safeAppDownloadLink = useMemo(() => {
        if (!props.appDownloadLink) {
            return '';
        }

        return makeUrlSafe(props.appDownloadLink);
    }, [props.appDownloadLink]);

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
                    id='globalHeader.productSwitcherMenu.downloadMenuItem.label'
                    defaultMessage='Download Apps'
                />
            }
            onClick={handleClick}
        />
    );
}

