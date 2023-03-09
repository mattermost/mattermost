import React from 'react';
import styled from 'styled-components';

import {Post} from '@mattermost/types/posts';

import {CustomPostContainer, CustomPostContent} from 'src/components/custom_post_styles';
import {formatText, messageHtmlToComponent} from 'src/webapp_globals';

import {Metric, MetricType} from 'src/types/playbook';

import {RunMetricData} from 'src/types/playbook_run';

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

    const metricsConfigs: Array<Metric> = JSON.parse(props.post.props.metricsConfigs);
    const metricsData: Array<RunMetricData> = JSON.parse(props.post.props.metricsData);

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
                    <TextBody>{mdText(props.post.props.retrospectiveText)}</TextBody>
                </FullWidthContent>
            </CustomPostContainerVertical>
        </>
    );
};

const HeaderGrid = styled.div`
    width: 100%;
    display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    row-gap: 19px;
    place-items: flex-start center;
    justify-items: stretch;
    margin: 8px 0px;
`;

const MetricInfo = styled.div`
    display: flex;
    align-items: center;
`;

const MetricIcon = styled.div`
    display: flex;
    width: 40px;
    height: 40px;
    padding: 10px;
    align-items: center;
    background: rgba(var(--button-bg-rgb), 0.08);
    border-radius: 4px;
    margin: 0px 8px;
`;

const ViewContent = styled.div`
    flex-direction: column;
`;

const Title = styled.div`
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    margin: 2px 0px;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
`;

const Value = styled.div`
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
    font-weight: normal;
    margin: 2px 0px;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
`;

const CustomPostContainerVertical = styled(CustomPostContainer)`
    flex-direction: column;
    max-width: 100%;
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
        border: none;
        height: 1px;
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
