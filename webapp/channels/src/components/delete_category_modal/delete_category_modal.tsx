// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ChannelCategory} from '@mattermost/types/channel_categories';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import GenericModal from 'components/generic_modal';

import {localizeMessage} from 'utils/utils';

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
                handleConfirm={this.handleConfirm}
                confirmButtonText={(
                    <FormattedMessage
                        id='delete_category_modal.delete'
                        defaultMessage='Delete'
                    />
                )}
                confirmButtonClassName={'delete'}
                enforceFocus={false}
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
