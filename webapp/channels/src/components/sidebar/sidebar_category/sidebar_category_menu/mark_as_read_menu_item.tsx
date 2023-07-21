// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as Menu from 'components/menu';

import {MarkAsUnreadIcon} from '@mattermost/compass-icons/components';
import {FormattedMessage} from 'react-intl';

type Props = ({
    id: string;
    handleViewCategory: () => void;
})

const MarkAsUnreadItem = ({
    id,
    handleViewCategory,
}: Props) => {
    return (
        <Menu.Item
            id={`view-${id}`}
            onClick={handleViewCategory}
            leadingElement={<MarkAsUnreadIcon size={18}/>}
            labels={(
                <FormattedMessage
                    id='sidebar_left.sidebar_category_menu.viewCategory'
                    defaultMessage='Mark category as read'
                />
            )}
        />
    );
};

export default MarkAsUnreadItem;
