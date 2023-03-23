// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
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
    flex: 1;
    display: flex;
    font-size: 14px;
    line-height: 20px;
    padding: 12px 16px 16px;
    margin-bottom: 12px;
    color: var(--center-channel-color);
    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
`;

const Lhs = styled.div`
    font-size: 18px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    padding: 0 6px 0 0;

    svg {
        margin-top: 2px;
    }
`;

const Centre = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const Rhs = styled.div`
    display: flex;
    align-items: flex-start;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const Button = styled.button`
    font-size: 18px;
    padding: 4px 1px;
    background: none;
    border-radius: 4px;
    border: 0;
    margin-top: -4px;

    :hover {
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
    font-weight: 600;
    color: var(--center-channel-color);
`;

const Bold = styled.span`
    font-weight: 600;
`;

export default MetricView;
