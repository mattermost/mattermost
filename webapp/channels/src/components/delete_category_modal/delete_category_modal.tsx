// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ChannelCategory} from '@mattermost/types/channel_categories';

import {GenericModal} from '@mattermost/components';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import {localizeMessage} from 'utils/utils';
import {t} from 'utils/i18n';

import '../category_modal.scss';

type Props = {
    category: ChannelCategory;
    onExited: () => void;
    actions: {
        deleteCategory: (categoryId: string) => void;
    };
};

type State = {
    show: boolean;
}

export default class DeleteCategoryModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
        };
    }

    handleConfirm = () => {
        this.props.actions.deleteCategory(this.props.category.id);
    };

    handleCancel = () => {
    this.props.onExited();

    };

    render() {
        return (
            <GenericModal
                ariaLabel={localizeMessage('delete_category_modal.deleteCategory', 'Delete this category?')}
                onExited={this.props.onExited}
                modalHeaderText={(
                    <FormattedMessage
                        id='delete_category_modal.deleteCategory'
                        defaultMessage='Delete this category?'
                    />
                )}
                handleCancel={this.handleCancel}
                handleConfirm={this.handleConfirm}
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
                            category_name: this.props.category.display_name,
                        }}
                    />
                </span>
            </GenericModal>
        );
    }
}

// TODO MM-52680 These strings are properly defined in @mattermost/components, but the i18n tooling currently can't
// find them there, so we've had to redefine them here
t('generic_modal.cancel');
t('generic_modal.confirm');
t('footer_pagination.count');
t('footer_pagination.prev');
t('footer_pagination.next');
