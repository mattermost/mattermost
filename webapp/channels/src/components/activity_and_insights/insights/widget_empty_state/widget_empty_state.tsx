// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    icon: string;
}

const WidgetEmptyState = (props: Props) => {
    return (
        <div className='empty-state'>
            <div className='empty-state-emoticon'>
                <i className={`icon icon-${props.icon}`}/>
            </div>
            <div className='empty-state-text'>
                <FormattedMessage
                    id='insights.topReactions.empty'
                    defaultMessage='Not enough data yet for this insight'
                />
            </div>
        </div>
    );
};

export default memo(WidgetEmptyState);
