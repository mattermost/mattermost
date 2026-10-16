// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {Metric, MetricType} from 'src/types/playbook';
import {ClockOutline, DollarSign, PoundSign} from 'src/components/backstage/playbook_edit/styles';
import {metricToString} from 'src/components/backstage/playbook_edit/metrics/shared';

interface Props {
    metric: Metric;
    editClick: () => void;
    deleteClick: () => void;
    disabled: boolean;
}

const MetricView = ({metric, editClick, deleteClick, disabled}: Props) => {
    const {formatMessage} = useIntl();
    const perRun = formatMessage({defaultMessage: 'per run'});

    let icon = <DollarSign sizePx={18}/>;
    if (metric.type === MetricType.MetricInteger) {
        icon = <PoundSign sizePx={18}/>;
    } else if (metric.type === MetricType.MetricDuration) {
        icon = <ClockOutline sizePx={18}/>;
    }

    const targetStr = metricToString(metric.target, metric.type, true);
    const target = metric.target === null ? '' : `${targetStr} ${perRun}`;

    return (
        <ViewContainer>
            <Lhs>{icon}</Lhs>
            <Centre>
                <Title>{metric.title}</Title>
                <Detail
                    title={formatMessage({defaultMessage: 'Target'}) + ':'}
                    text={target}
                />
                <Detail
                    title={formatMessage({defaultMessage: 'Description'}) + ':'}
                    text={metric.description}
                />
            </Centre>
            <Rhs>
                <Button
                    data-testid={'edit-metric'}
                    onClick={editClick}
                    disabled={disabled}
                >
                    <i className='icon-pencil-outline'/>
                </Button>
                <HorizontalSpacer size={6}/>
                <Button
                    data-testid={'delete-metric'}
                    onClick={deleteClick}
                >
                    <i className={'icon-trash-can-outline'}/>
                </Button>
            </Rhs>
        </ViewContainer>
    );
};

const ViewContainer = styled.div`
    display: flex;
    flex: 1;
    padding: 12px 16px 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    margin-bottom: 12px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 14px;
    line-height: 20px;
`;

const Lhs = styled.div`
    padding: 0 6px 0 0;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 18px;

    svg {
        margin-top: 2px;
    }
`;

const Centre = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    line-height: 20px;
`;

const Rhs = styled.div`
    display: flex;
    align-items: flex-start;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const Button = styled.button`
    padding: 4px 1px;
    border: 0;
    border-radius: 4px;
    margin-top: -4px;
    background: none;
    font-size: 18px;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const HorizontalSpacer = styled.div<{ size: number }>`
    margin-left: ${(props) => props.size}px;
`;

const Detail = ({title, text}: { title: string, text: string }) => {
    if (!text) {
        return (<></>);
    }
    return (
        <DetailDiv>
            <Bold>{title}</Bold>
            <DescrText>{text}</DescrText>
        </DetailDiv>
    );
};

const DetailDiv = styled.div`
    margin-top: 4px;
`;

const DescrText = styled.span`
    padding-left: 0.3em;
`;

const Title = styled.div`
    color: var(--center-channel-color);
    font-weight: 600;
`;

const Bold = styled.span`
    font-weight: 600;
`;

export default MetricView;
