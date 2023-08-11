// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import styled from 'styled-components';

const EditButton = styled.button`
    border: 0;
    margin: 0px;
    padding: 0px;
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    color: rgba(var(--center-channel-color-rgb), 0.56);
    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
    width: 24px;
    height: 24px;
    i.icon {
        font-size: 14.4px;
    }
`;

const EmptyPlace = styled.button`
    padding: 0px;
    background: transparent;
    border: 0px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    i {
        display: none;
        font-size: 14px;
        margin-left: 4px;
    }
    &:hover {
        color: rgba(var(--center-channel-color-rgb), 0.72);
        i {
            display: inline-block;
        }
    }
`;

interface EditableAreaProps {
    editable: boolean;
    content: React.ReactNode;
    emptyLabel: string;
    onEdit: () => void;
    className?: string;
}

const EditableAreaBase = ({editable, content, emptyLabel, onEdit, className}: EditableAreaProps) => {
    const {formatMessage} = useIntl();

    const allowEditArea = editable && content;

    return (
        <div className={className}>
            <div className='EditableArea__content'>
                {content}
                {!content && editable && (
                    <EmptyPlace
                        onClick={onEdit}
                        aria-label={formatMessage({id: 'channel_info_rhs.edit_link', defaultMessage: 'Edit'})}
                    >
                        {emptyLabel}
                        <i className='icon icon-pencil-outline edit-icon'/>
                    </EmptyPlace>
                )}
            </div>
            <div className='EditableArea__edit'>
                {allowEditArea ? (
                    <EditButton
                        onClick={onEdit}
                        aria-label={formatMessage({id: 'channel_info_rhs.edit_link', defaultMessage: 'Edit'})}
                    >
                        <i className='icon icon-pencil-outline'/>
                    </EditButton>
                ) : ''}
            </div>
        </div>
    );
};

const EditableArea = styled(EditableAreaBase)`
    display: flex;
    &>.EditableArea__content {
        flex: 1;
        p:last-child {
            margin-bottom:0;
        }
    }
    &:hover {
        &>.EditableArea__edit {
            visibility: visible;
        }
    }

    &>.EditableArea__edit {
        visibility: hidden;
        width: 24px;
    }
`;

export default EditableArea;
