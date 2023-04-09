// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import styled from 'styled-components';

import KeywordsSelector from 'src/components/keywords_selector';

interface Props {
    title: string;
    triggerModifier?: React.ReactNode;
    children: React.ReactNode;
}

const Trigger = (props: Props) => {
    const {formatMessage} = useIntl();

    return (
        <Container>
            <Header>
                <Legend>
                    <Label>{formatMessage({defaultMessage: 'Trigger'})}</Label>
                    <Title>{props.title}</Title>
                </Legend>
                {props.triggerModifier}
            </Header>
            <Body>
                {props.children}
            </Body>
        </Container>
    );
};

interface TriggerKeywordsProps {
    editable: boolean;
    keywords: string[];
    onUpdate: (newKeywords: string[]) => void;
    testId?: string;
}

export const TriggerKeywords = ({editable, keywords, onUpdate, testId}: TriggerKeywordsProps) => {
    return (
        <StyledKeywordsSelector
            testId={testId}
            enabled={editable}
            placeholderText={'Type a keyword or phrase, then press Enter on your keyboard'}
            keywords={keywords}
            onKeywordsChange={onUpdate}
        />
    );
};

const Container = styled.fieldset`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    box-sizing: border-box;

    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.08);
    border-radius: 4px;

    :first-child {
        margin-top: 28px;
    }

    :last-child {
        margin-bottom: 28px;
    }
`;

const Header = styled.div`
    background: rgba(var(--center-channel-color-rgb), 0.04);

    display: flex;
    flex-direction: column;
    justify-content: space-between;

    padding: 12px 20px;
    padding-right: 27px;
`;

const Legend = styled.legend`
    display: flex;
    flex-direction: column;
    border: none;
    margin: 0;
`;

const Label = styled.div`
    font-size: 11px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const Title = styled.div`
    font-size: 14px;
    font-weight: 600;
    color: var(--center-channel-color);
    margin-top: 2px;
`;

const Body = styled.div`
    padding: 24px;
`;

const StyledKeywordsSelector = styled(KeywordsSelector)`
    margin-top: 8px;
`;

export default Trigger;
