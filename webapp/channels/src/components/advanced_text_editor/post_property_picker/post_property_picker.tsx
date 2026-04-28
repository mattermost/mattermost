// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {PlaylistCheckIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {IconContainer} from 'components/advanced_text_editor/formatting_bar/formatting_icon';
import CompassDesignProvider from 'components/compass_design_provider';
import * as Menu from 'components/menu';

export type Props = {
    fields: PropertyField[];
    stagedFieldIds: string[];
    onToggleStaged: (fieldId: string) => void;
    disabled: boolean;
};

function PostPropertyPicker({fields, stagedFieldIds, onToggleStaged, disabled}: Props) {
    const {formatMessage} = useIntl();
    const theme = useSelector(getTheme);

    const [open, setOpen] = useState(false);

    const stagedSet = new Set(stagedFieldIds);

    const triggerLabel = formatMessage({
        id: 'post_property_picker.trigger',
        defaultMessage: 'Add property',
    });

    const handleSelect = useCallback((fieldId: string) => {
        onToggleStaged(fieldId);
    }, [onToggleStaged]);

    const items = fields.map((field) => {
        const checked = stagedSet.has(field.id);
        return (
            <Menu.Item
                key={field.id}
                id={`post-property-picker-item-${field.id}`}
                role='menuitemcheckbox'
                aria-checked={checked}
                onClick={() => handleSelect(field.id)}
                labels={<span>{field.name}</span>}
            />
        );
    });

    return (
        <CompassDesignProvider theme={theme}>
            <Menu.Container
                menuButton={{
                    id: 'postPropertyPickerButton',
                    as: 'div',
                    children: (
                        <IconContainer
                            id='postPropertyPickerButton'
                            className={classNames({control: true, active: open})}
                            disabled={disabled}
                            type='button'
                            aria-label={triggerLabel}
                        >
                            <PlaylistCheckIcon
                                size={18}
                                color='currentColor'
                            />
                        </IconContainer>
                    ),
                }}
                menu={{
                    id: 'post-property-picker-menu',
                    'aria-label': triggerLabel,
                    width: 'max-content',
                    onToggle: setOpen,
                    isMenuOpen: open,
                }}
                menuButtonTooltip={{
                    text: triggerLabel,
                }}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
            >
                {items.length === 0 ? (
                    <Menu.Item
                        key='post-property-picker-empty'
                        id='post-property-picker-empty'
                        disabled={true}
                        labels={
                            <span className='post-property-picker__empty'>
                                <FormattedMessage
                                    id='post_property_picker.empty'
                                    defaultMessage='No properties yet for this channel'
                                />
                            </span>
                        }
                    />
                ) : items}
            </Menu.Container>
        </CompassDesignProvider>
    );
}

export default memo(PostPropertyPicker);
