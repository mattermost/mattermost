// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {ChannelCategory} from '@mattermost/types/channel_categories';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import '../category_modal.scss';

type Props = {
    category: ChannelCategory;
    onExited: () => void;
    actions: {
        deleteCategory: (categoryId: string) => void;
    };
};

export default function DeleteCategoryModal(props: Props) {
    const intl = useIntl();

    const handleConfirm = useCallback(() => {
        props.actions.deleteCategory(props.category.id);
    }, [props.actions.deleteCategory, props.category]);

    return (
        <GenericModal
            compassDesign={true}
            ariaLabel={intl.formatMessage({id: 'delete_category_modal.deleteCategory', defaultMessage: 'Delete this category?'})}
            onExited={props.onExited}
            modalHeaderText={(
                <FormattedMessage
                    id='delete_category_modal.deleteCategory'
                    defaultMessage='Delete this category?'
                />
            )}
            handleCancel={props.onExited}
            handleConfirm={handleConfirm}
            confirmButtonText={(
                <FormattedMessage
                    id='delete_category_modal.delete'
                    defaultMessage='Delete'
                />
            )}
            confirmButtonClassName={'delete'}
        >
            <span className='delete-category__helpText'>
                <FormattedMarkdownMessage
                    id='delete_category_modal.helpText'
                    defaultMessage="Channels in **{category_name}** will move back to the Channels and Direct messages categories. You're not removed from any channels."
                    values={{
                        category_name: props.category.display_name,
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
