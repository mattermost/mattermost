// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useImperativeHandle, useState} from 'react';
import {useIntl} from 'react-intl';
import {useUpdateEffect} from 'react-use';

import {RunMetricData} from 'src/types/playbook_run';
import {Metric, MetricType} from 'src/types/playbook';
import {ClockOutline, DollarSign, PoundSign} from 'src/components/backstage/playbook_edit/styles';
import MetricInput from 'src/components/backstage/playbook_runs/playbook_run/metrics/metric_input';
import {isMetricValueValid, metricToString, stringToMetric} from 'src/components/backstage/playbook_edit/metrics/shared';
import {VerticalSpacer} from 'src/components/backstage/styles';

interface MetricsProps {
    metricsData: RunMetricData[];
    metricsConfigs: Metric[];
    notEditable: boolean;
    onEdit: (metricsData: RunMetricData[]) => void;
    flushChanges: () => void;
    focusMetricId?: string;
    idPrefix?: string;
}

const MetricsData = forwardRef(({metricsData, metricsConfigs, notEditable, onEdit, flushChanges, focusMetricId, idPrefix}: MetricsProps, ref) => {
    const {formatMessage} = useIntl();

    const produceValues = (config: Metric[], data: RunMetricData[]) => {
        const values = new Array(config.length);
        metricsConfigs.forEach((mc, index) => {
            const md = data.find((metric) => metric.metric_config_id === mc.id);
            values[index] = md ? metricToString(md.value, mc.type) : '';
        });
        return values;
    };

    const [inputsValues, setInputsValues] = useState(() => produceValues(metricsConfigs, metricsData));
    const [inputsErrors, setInputsErrors] = useState(new Array(metricsConfigs.length).fill(''));

    useUpdateEffect(() => {
        setInputsValues(produceValues(metricsConfigs, metricsData));
    }, [metricsData, metricsConfigs]);

    //  validateInputs function is called from retrospective component on publish button click, to validate metrics inputs
    useImperativeHandle(
        ref,
        () => ({
            validateInputs() {
                const errors = verifyInputs(inputsValues, true);
                setInputsErrors(errors);

                return !errors.some((e) => e !== '');
            },
        }),
    );

    const errorCurrencyInteger = formatMessage({defaultMessage: 'Please enter a number.'});
    const errorDuration = formatMessage({defaultMessage: 'Please enter a duration in the format: dd:hh:mm (e.g., 12:00:00).'});
    const errorEmptyValue = formatMessage({defaultMessage: 'Please fill in the metric value.'});

    const verifyInputs = (values: string[], forPublishing = false): string[] => {
        const errors = new Array(metricsConfigs.length).fill('');
        values.forEach((value, index) => {
            // If we do before publishing verification, consider empty value as invalid
            if (forPublishing && value === '') {
                errors[index] = errorEmptyValue;
            }
            if (!isMetricValueValid(metricsConfigs[index].type, value)) {
                errors[index] = metricsConfigs[index].type === MetricType.MetricDuration ? errorDuration : errorCurrencyInteger;
            }
        });
        return errors;
    };

    function stringsToMetricsData(values: string[], errors: string[]) {
        const newMetricsData = [...metricsData];
        errors.forEach((error, index) => {
            if (error) {
                return;
            }
            const metricNewValue = {metric_config_id: metricsConfigs[index].id, value: stringToMetric(values[index], metricsConfigs[index].type)};
            const existingMetricIdx = newMetricsData.findIndex((m) => m.metric_config_id === metricsConfigs[index].id);

            // Update metric value if exists, otherwise append new element
            if (existingMetricIdx > -1) {
                newMetricsData[existingMetricIdx] = metricNewValue;
            } else {
                newMetricsData.push(metricNewValue);
            }
        });
        return newMetricsData;
    }

    function updateMetrics(index: number, event: React.ChangeEvent<HTMLInputElement>) {
        const newList = [...inputsValues];
        newList[index] = event.target.value;
        const newErrors = verifyInputs(newList);
        setInputsValues(newList);
        setInputsErrors(newErrors);

        const newMetricsData = stringsToMetricsData(newList, newErrors);
        onEdit(newMetricsData);
    }

    return (
        <div>
            {
                metricsConfigs.map((mc, idx) => {
                    let placeholder = formatMessage({defaultMessage: ' Add value'});
                    let inputIcon = <DollarSign sizePx={18}/>;
                    if (mc.type === MetricType.MetricInteger) {
                        inputIcon = <PoundSign sizePx={18}/>;
                    } else if (mc.type === MetricType.MetricDuration) {
                        placeholder = formatMessage({defaultMessage: ' Add value (in dd:hh:mm)'});
                        inputIcon = <ClockOutline sizePx={18}/>;
                    }

                    return (
                        <div key={mc.id}>
                            <VerticalSpacer size={24}/>
                            <MetricInput
                                id={(idPrefix ?? '') + mc.id}
                                title={mc.title}
                                value={inputsValues[idx]}
                                placeholder={placeholder}
                                helpText={mc.description}
                                errorText={inputsErrors[idx]}
                                targetValue={metricToString(mc.target, mc.type, true)}
                                mandatory={true}
                                inputIcon={inputIcon}
                                onChange={(e) => updateMetrics(idx, e)}
                                disabled={notEditable}
                                autofocus={focusMetricId === mc.id}
                                onClickOutside={flushChanges}
                            />
                        </div>
                    );
                })
            }
        </div>
    );
});

export default MetricsData;
