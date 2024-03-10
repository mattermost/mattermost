// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

type Props = {
    className?: string;
};

const SharedUserIndicator: React.FC<Props> = (props: Props): JSX.Element => {
    const {formatMessage} = useIntl();

    return (
        <WithTooltip
            id='sharedTooltip'
            title={formatMessage({id: 'shared_user_indicator.tooltip', defaultMessage: 'From trusted organizations'})}
            placement='bottom'
        >
            <i
                className={classNames('icon icon-circle-multiple-outline', props.className)}
                aria-label={formatMessage({id: 'shared_user_indicator.aria_label', defaultMessage: 'shared user indicator'})}
            />

        </WithTooltip>
    );
};

export default SharedUserIndicator;
