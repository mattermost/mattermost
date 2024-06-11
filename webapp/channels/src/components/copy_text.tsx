// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants from 'utils/constants';
import {copyToClipboard} from 'utils/utils';

type Props = {
    value: string;
    defaultMessage?: string;
    idMessage?: string;
};

const CopyText = ({
    value,
    defaultMessage = 'Copy',
    idMessage = 'integrations.copy',
}: Props) => {
    const copyText = useCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        copyToClipboard(value);
    }, [value]);

    if (!document.queryCommandSupported('copy')) {
        return null;
    }

    const tooltip = (
        <Tooltip id='copy'>
            <FormattedMessage
                id={idMessage}
                defaultMessage={defaultMessage}
            />
        </Tooltip>
    );

    return (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='top'
            overlay={tooltip}
        >
            <a
                href='#'
                data-testid='copyText'
                className='fa fa-copy ml-2'
                onClick={copyText}
            />
        </OverlayTrigger>
    );
};

export default React.memo(CopyText);
