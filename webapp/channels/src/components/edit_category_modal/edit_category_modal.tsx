// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import {trackEvent} from 'actions/telemetry_actions';

import QuickInput, {MaxLengthInput} from 'components/quick_input';

import {localizeMessage} from 'utils/utils';

import '../category_modal.scss';

const MAX_LENGTH = 22;
const ACTION_WAIT_MS = 1000;

type Props = {
    onExited: () => void;
    currentTeamId: string;
    categoryId?: string;
    initialCategoryName?: string;
    channelIdsToAdd?: string[];
    actions: {
        createCategory: (teamId: string, displayName: string, channelIds?: string[] | undefined) => void;
        renameCategory: (categoryId: string, newName: string) => void;
    };
};

type State = {
    categoryName: string;
}

export default class EditCategoryModal extends React.PureComponent<Props, State> {
    timeoutId: NodeJS.Timeout | null = null;
    isProcessing = false;
    constructor(props: Props) {
        super(props);

        this.state = {
            categoryName: props.initialCategoryName || '',
        };
    }

    handleClear = () => {
        this.setState({categoryName: ''});
    };

    handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({categoryName: e.target.value});
    };

    handleCancel = () => {
        this.handleClear();
    };

    componentWillUnmount() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
    }

    handleConfirm = () => {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;
        this.timeoutId = setTimeout(() => {
            this.isProcessing = false;
        }, ACTION_WAIT_MS);

        if (this.props.categoryId) {
            this.props.actions.renameCategory(this.props.categoryId, this.state.categoryName);
        } else {
            this.props.actions.createCategory(this.props.currentTeamId, this.state.categoryName, this.props.channelIdsToAdd);
            trackEvent('ui', 'ui_sidebar_created_category');
        }
    };

    isConfirmDisabled = () => {
        return !this.state.categoryName ||
            (Boolean(this.props.initialCategoryName) && this.props.initialCategoryName === this.state.categoryName) || this.state.categoryName.length > MAX_LENGTH;
    };

    getText = () => {
        let modalHeaderText;
        let editButtonText;
        let helpText;

        if (this.props.categoryId) {
            modalHeaderText = (
                <FormattedMessage
                    id='rename_category_modal.renameCategory'
                    defaultMessage='Rename Category'
                />
            );
            editButtonText = (
                <FormattedMessage
                    id='rename_category_modal.rename'
                    defaultMessage='Rename'
                />
            );
        } else {
            modalHeaderText = (
                <FormattedMessage
                    id='create_category_modal.createCategory'
                    defaultMessage='Create New Category'
                />
            );
            editButtonText = (
                <FormattedMessage
                    id='create_category_modal.create'
                    defaultMessage='Create'
                />
            );
            helpText = (
                <FormattedMessage
                    id='edit_category_modal.helpText'
                    defaultMessage='Drag channels into this category to organize your sidebar.'
                />
            );
        }

        return {
            modalHeaderText,
            editButtonText,
            helpText,
        };
    };

    render() {
        const {
            modalHeaderText,
            editButtonText,
            helpText,
        } = this.getText();

        return (
            <GenericModal
                id='editCategoryModal'
                ariaLabel={localizeMessage({id: 'rename_category_modal.renameCategory', defaultMessage: 'Rename Category'})}
                modalHeaderText={modalHeaderText}
                confirmButtonText={editButtonText}
                compassDesign={true}
                onExited={this.props.onExited}
                handleEnterKeyPress={this.handleConfirm}
                handleConfirm={this.handleConfirm}
                handleCancel={this.handleCancel}
                isConfirmDisabled={this.isConfirmDisabled()}
            >
                <QuickInput
                    inputComponent={MaxLengthInput}
                    autoFocus={true}
                    className='form-control filter-textbox'
                    type='text'
                    value={this.state.categoryName}
                    placeholder={localizeMessage({id: 'edit_category_modal.placeholder', defaultMessage: 'Name your category'})}
                    clearable={true}
                    onClear={this.handleClear}
                    onChange={this.handleChange}
                    maxLength={MAX_LENGTH}
                />
                {Boolean(helpText) && <span className='edit-category__helpText'>
                    {helpText}
                </span>}
            </GenericModal>
        );
    }
}
