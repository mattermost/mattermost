// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {UserPropertyField} from '@mattermost/types/properties';

import {useUserPropertyFieldDelete} from './user_properties_delete_modal';
import {isCreatePending} from './user_properties_utils';

import './user_properties_orphaned_delete_button.scss';

type Props = {
    field: UserPropertyField;
    deleteField: (id: string) => void;
};

const OrphanedFieldDeleteButton: React.FC<Props> = ({field, deleteField}) => {
    const {promptDelete} = useUserPropertyFieldDelete();

    const handleDelete = () => {
        if (isCreatePending(field)) {
            deleteField(field.id);
        } else {
            promptDelete(field, true).then(() => deleteField(field.id));
        }
    };

    return (
        <button
            className='btn btn-icon btn-transparent orphaned-field-delete-button'
            onClick={handleDelete}
            disabled={field.delete_at !== 0}
            data-testid={`orphaned-field-delete-${field.id}`}
            aria-label='Delete orphaned field'
        >
            <TrashCanOutlineIcon
                size={18}
                color='var(--error-text)'
            />
        </button>
    );
};

export default OrphanedFieldDeleteButton;
