// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import {copyToClipboard} from 'utils/utils';

type Props = {
    label: MessageDescriptor;
    value: string;
};

const CopyText = ({
    label,
    value,
}: Props) => {
    const intl = useIntl();

    const copyText = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        copyToClipboard(value);
    }, [value]);

    if (!document.queryCommandSupported('copy')) {
        return null;
    }

    return (
        <WithTooltip title={label}>
            <button
                data-testid='copyText'
                className='btn btn-link fa fa-copy ml-2'
                aria-label={intl.formatMessage(label)}
                onClick={copyText}
            />
        </WithTooltip>
    );
};

export default React.memo(CopyText);
