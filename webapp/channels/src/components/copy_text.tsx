// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import {copyToClipboard} from 'utils/utils';

type Props = {
    value: string;
    tooltip?: ReactNode;
};

const CopyText = ({
    value,
    tooltip,
}: Props) => {
    const copyText = useCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        copyToClipboard(value);
    }, [value]);

    if (!document.queryCommandSupported('copy')) {
        return null;
    }

    return (
        <WithTooltip
            id='copyTextTooltip'
            placement='top'
            title={
                tooltip || (
                    <FormattedMessage
                        id='copyTextTooltip.copy'
                        defaultMessage='Copy'
                    />
                )
            }
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
