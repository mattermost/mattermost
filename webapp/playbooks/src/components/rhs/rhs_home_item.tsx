// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {Link} from 'react-router-dom';
import {CheckAllIcon, OpenInNewIcon, SyncIcon} from '@mattermost/compass-icons/components';

import {DraftPlaybookWithChecklist} from 'src/types/playbook';
import {SubtlePrimaryButton} from 'src/components/assets/buttons';
import {PillBox} from 'src/components/widgets/pill';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';

const Item = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 0 2rem;
    margin: 0 2.75rem;
    box-shadow: 0px 1px 0px rgba(var(--center-channel-color-rgb), 0.08);

    &:last-of-type {
        box-shadow: none;
    }

    > div {
        display: flex;
        overflow: hidden;
        flex-direction: column;
    }
`;

const Title = styled.h5`
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    margin-top: 0;
    margin-bottom: 0.25rem;

    a {
        display: flex;
        max-width: 100%;
        overflow: hidden;
        padding-right: 1rem;
        span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: inline-block;
        }
        svg {
            opacity: 0;
            flex-shrink: 0;
            color: rgba(var(--center-channel-color-rgb), 0.72);
            margin: 3px 0 0 3px;
            transition: opacity 0.15s ease-out;
        }
    }
    .app__body & a:hover,
    .app__body & a:focus {
        svg {
            opacity: 1;
        }
    }
    .app__body & a,
    .app__body & a:hover,
    .app__body & a:focus {
        color: var(--center-channel-color);
    }
`;

const Sub = styled.span`
    font-family: Open Sans;
    font-size: 12px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin-bottom: 1rem;

    .separator {
        margin: 0 0.5rem;
        font-size: 2rem;
        line-height: 12px;
        vertical-align: middle;
        font-weight: 600;
    }
`;

const Meta = styled.div`

`;

export const MetaItem = styled(PillBox)`
    font-family: Open Sans;
    font-weight: 600;
    font-size: 11px;
    line-height: 10px;
    height: 20px;
    padding: 3px 8px;
    margin-right: 4px;
    margin-bottom: 4px;
    display: inline-flex;
    align-items: center;
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    svg {
        margin-right: 4px;
    }
    .separator {
        margin: 0 0.35rem;
        font-size: 2rem;
        line-height: 10px;
        vertical-align: middle;
        font-weight: 600;
    }
`;

const RunButton = styled(SubtlePrimaryButton)`
    min-width: 7.25rem;
    max-width: 10rem;
    height: 7.25rem;
    justify-content: center;
    flex-direction: column;
    flex-shrink: 0;

    svg {
        margin-bottom: 0.5rem;
    }
`;

type RHSHomeTemplateProps = {
    title: string;
    template: DraftPlaybookWithChecklist;
    onUse: (template: DraftPlaybookWithChecklist) => void;
}

export const RHSHomeTemplate = ({
    title,
    template,
    onUse,
}: RHSHomeTemplateProps) => {
    const {formatMessage} = useIntl();
    const linkRef = useRef(null);
    return (
        <Item>
            <div data-testid='template-details'>
                <Title ref={linkRef}>
                    <Link
                        to={''}
                        onClick={(e) => {
                            e.preventDefault();
                            onUse(template);
                        }}
                        ref={linkRef}
                    >
                        <TextWithTooltipWhenEllipsis
                            id={`${title})_template_item`}
                            text={title}
                            parentRef={linkRef}

                        />
                        <OpenInNewIcon size={14}/>
                    </Link>
                </Title>
                <Sub/>
                <Meta>
                    <MetaItem>
                        <CheckAllIcon
                            color={'rgba(var(--center-channel-color-rgb), 0.72)'}
                            size={16}
                        />
                        {formatMessage({
                            defaultMessage: '{num_checklists, plural, =0 {no checklists} one {# checklist} other {# checklists}}',
                        }, {num_checklists: template.num_stages})}
                    </MetaItem>
                    <MetaItem>
                        <SyncIcon
                            size={16}
                            color={'rgba(var(--center-channel-color-rgb), 0.72)'}
                        />
                        {formatMessage({

                            defaultMessage: '{num_actions, plural, =0 {no actions} one {# action} other {# actions}}',
                        }, {num_actions: template.num_actions})}
                    </MetaItem>
                </Meta>
            </div>
            <RunButton
                data-testid={'use-playbook'}
                onClick={() => onUse(template)}
            >
                <OpenInNewIcon color={'var(--button-bg)'}/>
                {formatMessage({defaultMessage: 'Use'})}
            </RunButton>
        </Item>
    );
};
