// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {forwardRef, type ReactNode, type MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import EditIcon from 'components/widgets/icons/fa_edit_icon';

interface Props {

    /**
     * Settings title
     */
    title: ReactNode | string;

    /**
     * Option to disable opening the setting
     */
    isDisabled?: boolean;

    /**
     * Settings or tab section
     */
    section: string;

    /**
     * Function to update section
     */
    updateSection: (section: string) => void;

    /**
     * Settings description
     */
    describe?: ReactNode;
}

const SettingItemMin = forwardRef<HTMLButtonElement, Props>((props, ref) => {
    function handleClick(e: MouseEvent<HTMLButtonElement | HTMLDivElement>) {
        if (props.isDisabled) {
            return;
        }

        e.preventDefault();
        props.updateSection(props.section);
    }

    return (
        <div
            className={classNames('section-min', {isDisabled: props.isDisabled})}
            onClick={handleClick}
        >
            <div>
                <h4
                    id={props.section + 'Title'}
                    className={classNames('section-min__title', {isDisabled: props.isDisabled})}
                >
                    {props.title}
                </h4>
                {!props.isDisabled && (
                    <button
                        ref={ref}
                        id={props.section + 'Edit'}
                        className='color--link style--none section-min__edit'
                        onClick={handleClick}
                        aria-labelledby={props.section + 'Title ' + props.section + 'Edit'}
                        aria-expanded={false}
                    >
                        <EditIcon/>
                        <FormattedMessage
                            id='setting_item_min.edit'
                            defaultMessage='Edit'
                        />
                    </button>
                )}
            </div>
            <div
                id={props.section + 'Desc'}
                className={classNames('section-min__describe', {isDisabled: props.isDisabled})}
            >
                {props.describe}
            </div>
        </div>
    );
});

export default SettingItemMin;
