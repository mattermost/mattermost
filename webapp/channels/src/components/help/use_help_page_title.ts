// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

export default function useHelpPageTitle(titleDescriptor: MessageDescriptor) {
    const {formatMessage} = useIntl();
    const siteName = useSelector((state: GlobalState) => getConfig(state).SiteName) ?? '';

    useEffect(() => {
        const pageTitle = formatMessage(titleDescriptor);
        document.title = formatMessage(
            {id: 'help.document_title', defaultMessage: 'Help - {pageTitle} - {siteName}'},
            {pageTitle, siteName},
        );
    }, [formatMessage, siteName, titleDescriptor]);
}
