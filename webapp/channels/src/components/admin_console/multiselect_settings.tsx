// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactSelect, {ValueType} from 'react-select';

import FormError from 'components/form_error';

import Setting from './setting';

interface Option {
    value: string;
    text: string;
}

interface Props {
    id: string;
    values: Option[];
    label: React.ReactNode;
    selected: string[];
    onChange: (id: string, values: string[]) => void;
    disabled?: boolean;
    setByEnv: boolean;
    helpText?: React.ReactNode;
    noResultText?: React.ReactNode;
}

interface State {
    error: boolean;
}

export default class MultiSelectSetting extends React.PureComponent<
Props,
State
> {
    static defaultProps: Partial<Props> = {
        disabled: false,
    };

    constructor(props: Props) {
        super(props);

        this.state = {error: false};
    }

    handleChange = (newValue: ValueType<Option>) => {
        const values = (newValue as Option[]).map((n) => {
            return n.value;
        });

        this.props.onChange(this.props.id, values);
        this.setState({error: false});
    };

    calculateValue = () => {
        return this.props.selected.reduce<Option[]>((values, item) => {
            const found = this.props.values.find((e) => e.value === item);
            if (found) {
                values.push(found);
            }
            return values;
        }, []);
    };

    getOptionLabel = ({text}: { text: string}) => text;

    render() {
        return (
            <Setting
                label={this.props.label}
                inputId={this.props.id}
                helpText={this.props.helpText}
                setByEnv={this.props.setByEnv}
            >
                <ReactSelect
                    id={this.props.id}
                    isMulti={true}
                    getOptionLabel={this.getOptionLabel}
                    options={this.props.values}
                    delimiter={','}
                    clearable={false}
                    isDisabled={this.props.disabled || this.props.setByEnv}
                    noResultsText={this.props.noResultText}
                    onChange={this.handleChange}
                    value={this.calculateValue()}
                />
                <FormError error={this.state.error}/>
            </Setting>
        );
    }
}
