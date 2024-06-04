// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {copyToClipboard} from 'utils/utils';

import WithTooltip from './with_tooltip';

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
    const intl = useIntl();

    const copyText = useCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        copyToClipboard(value);
    }, [value]);

    if (!document.queryCommandSupported('copy')) {
        return null;
    }

    return (
        <WithTooltip
            id='copy'
            title={intl.formatMessage({
                id: idMessage,
                defaultMessage,
            })}
            placement='top'
        >
            <a
                href='#'
                data-testid='copyText'
                className='fa fa-copy ml-2'
                onClick={copyText}
            />
        </WithTooltip>
    );
};

export default React.memo(CopyText);
