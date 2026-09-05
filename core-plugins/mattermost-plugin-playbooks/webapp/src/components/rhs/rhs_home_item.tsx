// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
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
    padding: 1.5rem 0;
    margin: 0 2.75rem;
    box-shadow: 0 1px 0 rgba(var(--center-channel-color-rgb), 0.08);

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
    margin-top: 0;
    margin-bottom: 0.25rem;
    font-family: "Open Sans";
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;

    a {
        display: flex;
        overflow: hidden;
        max-width: 100%;
        padding-right: 1rem;

        span {
            display: inline-block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        svg {
            flex-shrink: 0;
            margin: 3px 0 0 3px;
            color: rgba(var(--center-channel-color-rgb), 0.72);
            opacity: 0;
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
    margin-bottom: 1rem;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-family: "Open Sans";
    font-size: 12px;
    line-height: 16px;

    .separator {
        margin: 0 0.5rem;
        font-size: 2rem;
        font-weight: 600;
        line-height: 12px;
        vertical-align: middle;
    }
`;

const Meta = styled.div`/* stylelint-disable no-empty-source */`;

export const MetaItem = styled(PillBox)`
    display: inline-flex;
    height: 20px;
    align-items: center;
    padding: 3px 8px;
    border-radius: 4px;
    margin-right: 4px;
    margin-bottom: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-family: "Open Sans";
    font-size: 11px;
    font-weight: 600;
    line-height: 10px;

    svg {
        margin-right: 4px;
    }

    .separator {
        margin: 0 0.35rem;
        font-size: 2rem;
        font-weight: 600;
        line-height: 10px;
        vertical-align: middle;
    }
`;

const RunButton = styled(SubtlePrimaryButton)`
    min-width: 7.25rem;
    max-width: 10rem;
    height: 7.25rem;
    flex-direction: column;
    flex-shrink: 0;
    justify-content: center;

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
