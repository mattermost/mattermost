// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';

import {Metric, MetricType} from 'src/types/playbook';
import {PrimaryButton} from 'src/components/assets/buttons';
import {ErrorText, HelpText, StyledInput} from 'src/components/backstage/playbook_runs/shared';
import {ClockOutline, DollarSign, PoundSign} from 'src/components/backstage/playbook_edit/styles';
import {isMetricValueValid, metricToString, stringToMetric} from 'src/components/backstage/playbook_edit/metrics/shared';
import MetricInput from 'src/components/backstage/playbook_runs/playbook_run/metrics/metric_input';
import {BaseTextArea} from 'src/components/assets/inputs';
import {VerticalSpacer} from 'src/components/backstage/styles';

type SetState = (prevState: Metric) => Metric;

interface Props {
    metric: Metric;
    setMetric: (setState: SetState) => void;
    otherTitles: string[];
    onAdd: (target: number | null) => void;
    deleteClick: () => void;
    saveToggle: boolean;
    saveFailed: () => void;
}

const MetricEdit = ({metric, setMetric, otherTitles, onAdd, deleteClick, saveToggle, saveFailed}: Props) => {
    const {formatMessage} = useIntl();
    const [curTargetString, setCurTargetString] = useState(() => metricToString(metric.target, metric.type));
    const [curSaveToggle, setCurSaveToggle] = useState(saveToggle);
    const [titleError, setTitleError] = useState('');
    const [targetError, setTargetError] = useState('');

    const errorTitleDuplicate = formatMessage({defaultMessage: 'A metric with the same name already exists. Please add a unique name for each metric.'});
    const errorTitleMissing = formatMessage({defaultMessage: 'Please add a title for your metric.'});
    const errorTargetCurrencyInteger = formatMessage({defaultMessage: 'Please enter a number, or leave the target blank.'});
    const errorTargetDuration = formatMessage({defaultMessage: 'Please enter a duration in the format: dd:hh:mm (e.g., 12:00:00), or leave the target blank.'});

    const verifyAndSave = (): boolean => {
        // Is the title unique?
        if (otherTitles.includes(metric.title)) {
            setTitleError(errorTitleDuplicate);
            return false;
        }

        // Is the title set?
        if (metric.title === '') {
            setTitleError(errorTitleMissing);
            return false;
        }

        // Is the target valid?
        if (!isMetricValueValid(metric.type, curTargetString)) {
            setTargetError(metric.type === MetricType.MetricDuration ? errorTargetDuration : errorTargetCurrencyInteger);
            return false;
        }

        // target is valid. Convert it and save the metric.
        const target = stringToMetric(curTargetString, metric.type);
        onAdd(target);
        return true;
    };

    if (saveToggle !== curSaveToggle) {
        // we've been asked to save, either internally or externally, so verify and save if possible.
        setCurSaveToggle(saveToggle);
        const success = verifyAndSave();
        if (!success) {
            saveFailed();
        }
    }

    let inputIcon = <DollarSign sizePx={18}/>;
    let typeTitle = (
        <FormattedMessage
            defaultMessage='{icon} Cost'
            values={{icon: inputIcon}}
            tagName={React.Fragment}
        />
    );
    if (metric.type === MetricType.MetricInteger) {
        inputIcon = <PoundSign sizePx={18}/>;
        typeTitle = (
            <FormattedMessage
                defaultMessage='{icon} Integer'
                values={{icon: inputIcon}}
                tagName={React.Fragment}
            />
        );
    } else if (metric.type === MetricType.MetricDuration) {
        inputIcon = <ClockOutline sizePx={18}/>;
        typeTitle = (
            <FormattedMessage
                defaultMessage='{icon} Duration (in dd:hh:mm)'
                values={{icon: inputIcon}}
                tagName={React.Fragment}
            />
        );
    }

    return (
        <Container>
            <EditHeader>
                <FormattedMessage
                    defaultMessage='Type: {typeTitle}'
                    values={{typeTitle: <Bold>{typeTitle}</Bold>}}
                    tagName={React.Fragment}
                />
                <Button
                    data-testid={'delete-metric'}
                    onClick={deleteClick}
                >
                    <i className={'icon-trash-can-outline'}/>
                </Button>
            </EditHeader>
            <EditContainer>
                <Title>{formatMessage({defaultMessage: 'Title'})}</Title>
                <StyledInput
                    error={titleError !== ''}
                    placeholder={formatMessage({defaultMessage: 'Name of the metric'})}
                    type='text'
                    value={metric.title}
                    onChange={(e) => {
                        const title = e.target.value;
                        setMetric((prevState) => ({...prevState, title}));
                        setTitleError('');
                    }}
                    autoFocus={true}
                    maxLength={64}
                />
                <Error text={titleError}/>
                <VerticalSpacer size={16}/>

                <MetricInput
                    id={metric.id}
                    title={formatMessage({defaultMessage: 'Target per run'})}
                    value={curTargetString}
                    placeholder={formatMessage({defaultMessage: 'Target value for each run'})}
                    helpText={formatMessage({defaultMessage: 'We’ll show you how close or far from the target each run’s value is and also plot it on a chart.'})}
                    errorText={targetError}
                    inputIcon={inputIcon}
                    onChange={(e) => {
                        setCurTargetString(e.target.value.trim());
                        setTargetError('');
                    }}
                />
                <VerticalSpacer size={16}/>
                <Title>{formatMessage({defaultMessage: 'Description'})}</Title>
                <StyledTextarea
                    placeholder={formatMessage({defaultMessage: 'Describe what this metric is about'})}
                    rows={2}
                    value={metric.description}
                    onChange={(e) => {
                        const description = e.target.value;
                        setMetric((prevState) => ({...prevState, description}));
                    }}
                />
                <HelpText>{formatMessage({defaultMessage: 'Add details on what this metric is about and how it should be filled in. This description will be available on the retrospective page for each run where values for these metrics will be input.'})}</HelpText>
                <VerticalSpacer size={16}/>
                <PrimaryButton onClick={verifyAndSave}>{formatMessage({defaultMessage: 'Save'})}</PrimaryButton>
            </EditContainer>
        </Container>
    );
};

const Container = styled.div`
    flex: 1;
`;

const EditHeader = styled.div`
    display: flex;
    align-items: center;
    font-size: 14px;
    line-height: 20px;
    padding: 12px 24px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px 4px 0 0;
`;

const Button = styled.button`
    font-size: 18px;
    padding: 4px 1px;
    background: none;
    border-radius: 4px;
    border: 0;
    margin-left: auto;

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const EditContainer = styled.div`
    font-size: 14px;
    line-height: 20px;
    padding: 16px 24px 24px;
    margin-bottom: 12px;
    color: var(--center-channel-color);
    background: var(--center-channel-bg);
    border-radius: 0 0 4px 4px;
`;

const Bold = styled.span`
    display: flex;
    align-items: center;
    font-weight: 600;

    svg {
        margin: 0 5px;
    }
`;

const Title = styled.div`
    font-weight: 600;
    margin: 0 0 8px 0;
`;

const Error = ({text}: { text: string }) => (
    text === '' ? null : <ErrorText>{text}</ErrorText>
);
const StyledTextarea = styled(BaseTextArea)`
    width: 100%;
    margin-bottom: -4px;
`;

export default MetricEdit;
