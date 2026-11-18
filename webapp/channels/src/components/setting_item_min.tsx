// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {type ReactNode, type MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import EditIcon from 'components/widgets/icons/fa_edit_icon';

import {a11yFocus} from 'utils/utils';

interface Props {

    /**
     * Settings title
     */
    title: ReactNode;

    /**
     * Option to disable opening the setting
     */
    isDisabled?: boolean;

    /**
     * Settings or tab section
     */
    section: string;

    /** The section's scope (a tab's `settings.<tab>.section`, or `settings.plugin_panel.section`) and its key: the root is `<testId>:<testKey>--group`. */
    testId?: string;
    testKey?: string | number;

    /**
     * Function to update section
     */
    updateSection: (section: string) => void;

    /**
     * Settings description
     */
    describe?: ReactNode;

    /**
     * Replacement in place of edit button when the setting (in collapsed mode) is disabled
     */
    collapsedEditButtonWhenDisabled?: ReactNode;
}

export default class SettingItemMin extends React.PureComponent<Props> {
    private edit: HTMLButtonElement | null = null;

    focus() {
        a11yFocus(this.edit);
    }

    private getEdit = (node: HTMLButtonElement) => {
        this.edit = node;
    };

    handleClick = (e: MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
        if (this.props.isDisabled) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        this.props.updateSection(this.props.section);
    };

    render() {
        let editButtonComponent: ReactNode;

        let rootTestId;
        let editTestId;
        let titleTestId;
        let describeTestId;
        if (this.props.testId) {
            rootTestId = `${this.props.testId}:${this.props.testKey}--group`;
            editTestId = `${this.props.testId}.edit--button`;
            titleTestId = `${this.props.testId}.title--text`;
            describeTestId = `${this.props.testId}.describe--text`;
        }

        if (this.props.isDisabled) {
            if (this.props.collapsedEditButtonWhenDisabled) {
                editButtonComponent = this.props.collapsedEditButtonWhenDisabled;
            } else {
                editButtonComponent = null;
            }
        } else {
            editButtonComponent = (
                <button
                    ref={this.getEdit}
                    id={this.props.section + 'Edit'}
                    className='color--link style--none section-min__edit'
                    data-testid={editTestId}
                    onClick={this.handleClick}
                    aria-labelledby={this.props.section + 'Title ' + this.props.section + 'Edit'}
                    aria-expanded={false}
                >
                    <EditIcon/>
                    <FormattedMessage
                        id='setting_item_min.edit'
                        defaultMessage='Edit'
                    />
                </button>
            );
        }

        return (
            <div
                className={classNames('section-min', {isDisabled: this.props.isDisabled})}
                role='group'
                data-testid={rootTestId}
                onClick={this.handleClick}
            >
                <div
                    className='section-min__header'
                >
                    <h4
                        id={this.props.section + 'Title'}
                        data-testid={titleTestId}
                        className={classNames('section-min__title', {isDisabled: this.props.isDisabled})}
                    >
                        {this.props.title}
                    </h4>
                    {editButtonComponent}
                </div>
                <div
                    id={this.props.section + 'Desc'}
                    data-testid={describeTestId}
                    className={classNames('section-min__describe', {isDisabled: this.props.isDisabled})}
                >
                    {this.props.describe}
                </div>
            </div>
        );
    }
}
