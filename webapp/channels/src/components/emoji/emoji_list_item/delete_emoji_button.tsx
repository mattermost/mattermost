// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import DeleteIntegrationLink from 'components/integrations/delete_integration_link';

type Props = {
    onDelete: () => void;
}

export default function DeleteEmojiButton(props: Props) {
    return (
        <DeleteIntegrationLink
            confirmButtonText={
                <FormattedMessage
                    id='emoji_list.delete.confirm.button'
                    defaultMessage='Delete'
                />
            }
            linkText={
                <FormattedMessage
                    id='emoji_list.delete'
                    defaultMessage='Delete'
                />
            }
            modalMessage={
                <FormattedMessage
                    id='emoji_list.delete.confirm.msg'
                    defaultMessage='This action permanently deletes the custom emoji. Are you sure you want to delete it?'
                />
            }
            modalTitle={
                <FormattedMessage
                    id='emoji_list.delete.confirm.title'
                    defaultMessage='Delete Custom Emoji'
                />
            }
            onDelete={props.onDelete}
        />
    );
}
