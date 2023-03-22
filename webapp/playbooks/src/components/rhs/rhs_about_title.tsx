// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {useSelector} from 'react-redux';
import styled, {StyledComponent} from 'styled-components';

import {GlobalState} from '@mattermost/types/store';
import General from 'mattermost-redux/constants/general';
import Permissions from 'mattermost-redux/constants/permissions';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {FormattedMessage} from 'react-intl';

import StatusBadge, {BadgeType} from 'src/components/backstage/status_badge';
import {useClickOutsideRef} from 'src/hooks/general';
import {SemiBoldHeading} from 'src/styles/headings';
import {PlaybookRunStatus} from 'src/types/playbook_run';

interface Props {
    onEdit: (newTitle: string) => void;
    value: string;
    renderedTitle?: StyledComponent<'div', any, {}, never>;
    status: PlaybookRunStatus;
}

const TitleWrapper = styled.div`
    display: flex;
`;

const StatusBadgeWrapper = styled(StatusBadge) `
    margin-right: 75px;
    top: -3px;
`;

const RHSAboutTitle = (props: Props) => {
    const [editing, setEditing] = useState(false);
    const [editedValue, setEditedValue] = useState(props.value);
    const permissionToChangeTitle = useSelector(hasPermissionsToChangeChannelName);

    const invalidValue = editedValue.length < 2;

    const inputRef = useRef(null);

    useEffect(() => {
        setEditedValue(props.value);
    }, [props.value]);

    const saveAndClose = () => {
        if (!invalidValue && permissionToChangeTitle) {
            props.onEdit(editedValue);
            setEditing(false);
        }
    };

    const discardAndClose = () => {
        setEditedValue(props.value);
        setEditing(false);
    };

    let onRenderedTitleClick = () => { /* do nothing */};
    if (permissionToChangeTitle) {
        onRenderedTitleClick = () => {
            const selectedText = window.getSelection();
            const hasSelectedText = selectedText !== null && selectedText.toString() !== '';
            if (!hasSelectedText) {
                setEditing(true);
            }
        };
    }

    useClickOutsideRef(inputRef, saveAndClose);

    if (!editing) {
        const RenderedTitle = props.renderedTitle ?? DefaultRenderedTitle;

        return (
            <TitleWrapper>
                <RenderedTitle
                    onClick={onRenderedTitleClick}
                    data-testid='rendered-run-name'
                >
                    {editedValue}
                </RenderedTitle>
                {props.status === PlaybookRunStatus.Finished &&
                    <StatusBadgeWrapper status={BadgeType.Finished}/>
                }
            </TitleWrapper>
        );
    }

    return (
        <>
            <TitleInput
                data-testid='textarea-run-name'
                type={'text'}
                ref={inputRef}
                onChange={(e) => setEditedValue(e.target.value)}
                value={editedValue}
                maxLength={59}
                autoFocus={true}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        saveAndClose();
                    } else if (e.key === 'Escape') {
                        discardAndClose();
                    }
                }}
                onBlur={saveAndClose}
                onFocus={(e) => {
                    const val = e.target.value;
                    e.target.value = '';
                    e.target.value = val;
                }}
            />
            {invalidValue &&
            <ErrorMessage>
                <FormattedMessage defaultMessage='Run name must have at least two characters'/>
            </ErrorMessage>
            }
        </>
    );
};

const hasPermissionsToChangeChannelName = (state: GlobalState) => {
    const channel = getCurrentChannel(state);
    if (!channel) {
        return false;
    }

    const permission = channel.type === General.OPEN_CHANNEL ? Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES : Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES;

    return haveIChannelPermission(state, channel.team_id, channel.id, permission);
};

const TitleInput = styled.input`
    width: calc(100% - 75px);
    height: 30px;
    padding: 4px 8px;
    margin-bottom: 5px;
    margin-top: -3px;

    border: none;
    border-radius: 5px;
    box-shadow: none;

    background: rgba(var(--center-channel-color-rgb), 0.04);

    &:focus {
        box-shadow: none;
    }

    color: var(--center-channel-color);
    font-size: 18px;
    line-height: 24px;
    font-weight: 600;
`;

const ErrorMessage = styled.div`
    color: var(--dnd-indicator);

    font-size: 12px;
    line-height: 16px;

    margin-bottom: 12px;
    margin-left: 8px;
`;

export const DefaultRenderedTitle = styled.div`
    ${SemiBoldHeading}

    padding: 0 8px;

    max-width: 100%;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    height: 30px;
    line-height: 24px;

    font-size: 18px;
    font-weight: 600;

    color: var(--center-channel-color);

    :hover {
        cursor: text;
    }

    border-radius: 5px;

    margin-bottom: 2px;
`;

export default RHSAboutTitle;
