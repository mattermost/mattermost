// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {ChannelCategory} from '@mattermost/types/channel_categories';

import {deleteCategory} from 'mattermost-redux/actions/channel_categories';

import '../category_modal.scss';

type Props = {
    category: ChannelCategory;
    onExited: () => void;
};

const confirmButtonText = (
    <FormattedMessage
        id='delete_category_modal.delete'
        defaultMessage='Delete'
    />
);

const modalHeaderText = (
    <FormattedMessage
        id='delete_category_modal.deleteCategory'
        defaultMessage='Delete this category?'
    />
);

export default function DeleteCategoryModal({
    category,
    onExited,
}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();

    const handleConfirm = useCallback(() => {
        dispatch(deleteCategory(category.id));
    }, [category.id, dispatch]);

    return (
        <GenericModal
            compassDesign={true}
            ariaLabel={intl.formatMessage({id: 'delete_category_modal.deleteCategory', defaultMessage: 'Delete this category?'})}
            onExited={onExited}
            modalHeaderText={modalHeaderText}
            handleCancel={onExited}
            handleConfirm={handleConfirm}
            confirmButtonText={confirmButtonText}
            confirmButtonClassName={'delete'}
        >
            <span className='delete-category__helpText'>
                <FormattedMessage
                    id='delete_category_modal.helpText'
                    defaultMessage="Channels in <b>{category_name}</b> will move back to the Channels and Direct messages categories. You're not removed from any channels."
                    values={{
                        category_name: category.display_name,
                        b: (chunks: string) => <b>{chunks}</b>,
                    }}
                />
            </span>
        </GenericModal>
    );
}

// TODO MM-52680 These strings are properly defined in @mattermost/components, but the i18n tooling currently can't
// find them there, so we've had to redefine them here
defineMessages({
    cancel: {
        id: 'generic_modal.cancel',
        defaultMessage: 'Cancel',
    },
    confirm: {
        id: 'generic_modal.confirm',
        defaultMessage: 'Confirm',
    },
    paginationCount: {
        id: 'footer_pagination.count',
        defaultMessage: 'Showing {startCount, number}-{endCount, number} of {total, number}',
    },
    paginationNext: {
        id: 'footer_pagination.next',
        defaultMessage: 'Next',
    },
    paginationPrev: {
        id: 'footer_pagination.prev',
        defaultMessage: 'Previous',
    },
});
