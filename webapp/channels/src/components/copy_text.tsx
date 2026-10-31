// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import {ContentCopyIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

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
    const ariaLabel = intl.formatMessage(label);

    const copyText = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        copyToClipboard(value);
    }, [value]);

    if (!document.queryCommandSupported('copy')) {
        return null;
    }

    return (
        <WithTooltip title={label}>
            <IconButton
                data-testid='copyText'
                size='x-small'
                className='ml-2'
                icon={<Icon glyph={<ContentCopyIcon/>}/>}
                aria-label={ariaLabel}
                onClick={copyText}
            />
        </WithTooltip>
    );
};

export default React.memo(CopyText);
