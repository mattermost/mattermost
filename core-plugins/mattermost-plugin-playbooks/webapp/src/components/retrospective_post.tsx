// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {Post} from '@mattermost/types/posts';

import {CustomPostContainer, CustomPostContent} from 'src/components/custom_post_styles';
import {formatText, messageHtmlToComponent} from 'src/webapp_globals';

import {Metric, MetricType} from 'src/types/playbook';

import {RunMetricData} from 'src/types/playbook_run';

import {
    isArrayOf,
    isMetric,
    isMetricData,
    safeJSONParse,
} from 'src/utils';

import {ClockOutline, DollarSign, PoundSign} from './backstage/playbook_edit/styles';
import {metricToString} from './backstage/playbook_edit/metrics/shared';

interface Props {
    post: Post;
}

export const RetrospectivePost = (props: Props) => {
    const style = getComputedStyle(document.body);
    const colorName = style.getPropertyValue('--button-bg');

    const markdownOptions = {
        singleline: false,
        mentionHighlight: true,
        atMentions: true,
    };

    const messageHtmlToComponentOptions = {
        hasPluginTooltips: true,
    };

    const mdText = (text: string) => messageHtmlToComponent(formatText(text, markdownOptions), true, messageHtmlToComponentOptions);

    const parsedMetricsConfigs = safeJSONParse<unknown>(props.post.props?.metricsConfigs);
    const parsedMetricsData = safeJSONParse<unknown>(props.post.props?.metricsData);

    const metricsConfigs: Array<Metric> = isArrayOf(parsedMetricsConfigs, isMetric) ? parsedMetricsConfigs : [];
    const metricsData: Array<RunMetricData> = isArrayOf(parsedMetricsData, isMetricData) ? parsedMetricsData : [];

    const retrospectiveText = typeof props.post.props.retrospectiveText === 'string' ? props.post.props.retrospectiveText : '';

    return (
        <>
            <TextBody>{mdText(props.post.message)}</TextBody>
            <CustomPostContainerVertical>
                {metricsConfigs &&
                <>
                    <HeaderGrid>
                        {
                            metricsConfigs.map((mc) => {
                                const inputIcon = getMetricInputIcon(mc.type, colorName);
                                const md = metricsData.find((metric) => metric.metric_config_id === mc.id);

                                return (md &&
                                    <MetricInfo key={mc.id}>
                                        <MetricIcon>
                                            {inputIcon}
                                        </MetricIcon>
                                        <ViewContent>
                                            <Title>{mc.title}</Title>
                                            <Value>{metricToString(md.value, mc.type, true)}</Value>
                                        </ViewContent>
                                    </MetricInfo>
                                );
                            })
                        }
                    </HeaderGrid>
                    <Separator/>
                </>}
                <FullWidthContent>
                    <TextBody>{mdText(retrospectiveText)}</TextBody>
                </FullWidthContent>
            </CustomPostContainerVertical>
        </>
    );
};

const HeaderGrid = styled.div`
    display: grid;
    width: 100%;
    margin: 8px 0;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    place-items: flex-start center;
    justify-items: stretch;
    row-gap: 19px;
`;

const MetricInfo = styled.div`
    display: flex;
    align-items: center;
`;

const MetricIcon = styled.div`
    display: flex;
    width: 40px;
    height: 40px;
    align-items: center;
    padding: 10px;
    border-radius: 4px;
    margin: 0 8px;
    background: rgba(var(--button-bg-rgb), 0.08);
`;

const ViewContent = styled.div`
    flex-direction: column;
`;

const Title = styled.div`
    overflow: hidden;
    max-width: 220px;
    margin: 2px 0;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const Value = styled.div`
    overflow: hidden;
    max-width: 220px;
    margin: 2px 0;
    color: var(--center-channel-color);
    font-size: 16px;
    font-weight: normal;
    line-height: 24px;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const CustomPostContainerVertical = styled(CustomPostContainer)`
    max-width: 100%;
    flex-direction: column;
    padding: 12px 16px;
`;

const FullWidthContent = styled(CustomPostContent)`
    width: 100%;
    padding: 0;
`;

const TextBody = styled.div`
    width: 100%;
    margin-top: 4px;
    margin-bottom: 4px;
`;

const Separator = styled.hr`
    padding-bottom: 0;

    && {
        height: 1px;
        border: none;
        background: rgba(var(--center-channel-color-rgb), 0.61);
    }
`;

function getMetricInputIcon(metricType: string, colorName: string) {
    let inputIcon = (
        <DollarSign
            sizePx={24}
            color={colorName}
        />);
    if (metricType === MetricType.MetricInteger) {
        inputIcon = (
            <PoundSign
                sizePx={24}
                color={colorName}
            />);
    } else if (metricType === MetricType.MetricDuration) {
        inputIcon = (
            <ClockOutline
                sizePx={24}
                color={colorName}
            />);
    }
    return inputIcon;
}
