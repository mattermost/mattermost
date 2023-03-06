// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';

import {useSelector} from 'react-redux';
import {Team} from '@mattermost/types/teams';
import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from '@mattermost/types/store';

import {formatText, messageHtmlToComponent} from 'src/webapp_globals';
import {ChannelNamesMap} from 'src/types/backstage';
import {handleFormattedTextClick} from 'src/browser_routing';

interface TitleProps {
    value: string;
    onEdit: (value: string) => void;
    editingItem: boolean;
    skipped: boolean;
    clickable: boolean;
}

const ChecklistItemTitle = (props: TitleProps) => {
    const {formatMessage} = useIntl();
    const placeholder = formatMessage({defaultMessage: 'Add a title'});

    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const team = useSelector<GlobalState, Team>(getCurrentTeam);
    const relativeTeamUrl = useSelector<GlobalState, string>(getCurrentRelativeTeamUrl);

    const markdownOptions = {
        singleline: true,
        mentionHighlight: false,
        atMentions: true,
        team,
        channelNamesMap,
    };

    const computeHeight = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        e.target.style.height = '5px';
        e.target.style.height = (e.target.scrollHeight) + 'px';
    };

    if (props.editingItem) {
        return (
            <TitleTextArea
                data-testid='checklist-item-textarea-title'
                value={props.value}
                placeholder={placeholder}
                onChange={(e) => {
                    props.onEdit(e.target.value);
                }}
                autoFocus={true}
                onFocus={(e) => {
                    const val = e.target.value;
                    e.target.value = '';
                    e.target.value = val;
                    computeHeight(e);
                }}
                onInput={computeHeight}
            />
        );
    }

    const titleText = messageHtmlToComponent(formatText(props.value, {...markdownOptions, singleline: false}), true, {});
    return (
        <RenderedTitle
            data-testid='rendered-checklist-item-title'
            clickable={props.clickable}
        >
            {props.value ? (
                <RenderedTitle onClick={((e) => handleFormattedTextClick(e, relativeTeamUrl))}>
                    {props.skipped ? <StrikeThrough data-cy={'skipped'}>{titleText}</StrikeThrough> : titleText}
                </RenderedTitle>
            ) : (
                <PlaceholderText>{placeholder}</PlaceholderText>
            )}
        </RenderedTitle>
    );
};

const PlaceholderText = styled.span`
    opacity: 0.5;
`;

const commonTitleStyle = css`
    color: var(--center-channel-color);
    border: none;
    background: none;
    font-style: normal;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    padding: 0 4px 0 0;

    p {
        white-space: pre-wrap;
    }
`;

const RenderedTitle = styled.div<{clickable?: boolean}>`
    ${commonTitleStyle}

    p:last-child {
        margin-bottom: 0;
    }

    ${({clickable}) => clickable && css`
        cursor: pointer;

        :hover {
            cursor: pointer;
        }
    `}
`;

const TitleTextArea = styled.textarea`
    ${commonTitleStyle} {
    }

    display: block;
    resize: none;
    width: 100%;

    &:focus {
        box-shadow: none;
    }
`;

const StrikeThrough = styled.div`
    text-decoration: line-through;
`;

export default ChecklistItemTitle;
