// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';

import GetLinkModal from 'components/get_link_modal';

import type {PropsFromRedux} from './index';

type Props = PropsFromRedux & {
    onExited: () => void;
    fileId: string;
};

const GetPublicLinkModal = ({
    actions,
    fileId,
    onExited,
    link = '',
}: Props) => {
    const intl = useIntl();
    const [show, setShow] = useState<boolean>(true);

    useEffect(() => {
        actions.getFilePublicLink(fileId);
    }, []);

    const onHide = useCallback(() => setShow(false), []);

    return (
        <GetLinkModal
            show={show}
            onHide={onHide}
            onExited={onExited}
            title={intl.formatMessage({id: 'get_public_link_modal.title', defaultMessage: 'Copy Public Link'})}
            helpText={intl.formatMessage({id: 'get_public_link_modal.help', defaultMessage: 'The link below allows anyone to see this file without being registered on this server.'})}
            link={link}
        />
    );
};

export default memo(GetPublicLinkModal);
