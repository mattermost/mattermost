// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';

import {GlobalState} from '@mattermost/types/store';
import {Team} from '@mattermost/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {useClickOutsideRef} from 'src/hooks';
import {StyledTextarea} from 'src/components/backstage/styles';
import PostText from 'src/components/post_text';

interface Props {
    teamId: string;
    text: string;
    isEditable: boolean;
    onEdit: (text: string) => void;
    flushChanges: () => void;
}

const ReportTextArea = ({text, isEditable, onEdit, flushChanges, teamId}: Props) => {
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, teamId));
    const textareaRef = useRef(null);
    const [editing, setEditing] = useState(false);
    useClickOutsideRef(textareaRef, () => {
        flushChanges();
        setEditing(false);
    });

    if (isEditable && editing) {
        return (
            <StyledTextArea
                ref={textareaRef}
                autoFocus={true}
                onFocus={(e) => {
                    // move the cursor to the end of the text
                    const val = e.target.value;
                    e.target.value = '';
                    e.target.value = val;
                }}
                onChange={(e) => {
                    onEdit(e.target.value);
                }}
                defaultValue={text}
            />
        );
    }

    return (
        <PostTextContainer
            published={!isEditable}
            data-testid={'retro-report-text'}
            onClick={() => {
                if (isEditable) {
                    setEditing(true);
                }
            }}

        >
            <PostText
                text={text}
                team={team}
            />
        </PostTextContainer>
    );
};

const StyledTextArea = styled(StyledTextarea)`
    margin: 8px 0 0 0;
    min-height: 200px;
    font-size: 12px;
    flex-grow: 1;
`;

const PostTextContainer = styled.div<{ published?: boolean}>`
    background-color: ${(props) => (props.published ? 'rgba(var(--center-channel-color-rgb),0.03)' : 'var(--center-channel-bg)')};

    margin: 8px 0 0 0;
    padding: 10px 25px 0 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 8px;
    flex-grow: 1;

    :hover {
        cursor: text;
    }
`;

export default ReportTextArea;
