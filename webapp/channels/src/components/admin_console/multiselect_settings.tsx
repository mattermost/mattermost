// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.


import React from 'react';
import ReactSelect from 'react-select';

import FormError from 'components/form_error';

import Setting from './setting';

//removed "Proptypes" import and added interface 

interface Props {
    id: string;
    values:any[];
    label: React.ReactNode;
    selected: string[],
    onChange(id: string, values:(string | number)[]): void
    disabled: boolean;
    setByEnv: boolean;
    helpText: React.ReactNode;
    noResultText: React.ReactNode;
}

export default class MultiSelectSetting extends React.PureComponent <Props> {
      static defaultProps: Partial<Props> = {
        disabled: false,
    };

    constructor(props:Props) {
        super(props);

        this.state = {error: false};
    }

    handleChange = (newValue: any[]) => { //not sure what data type value is
        const values = newValue.map((n) => {
            return n.value;
        });

        this.props.onChange(this.props.id, values);
        this.setState({error: false});
    };

    calculateValue = () => {
        return this.props.selected.reduce((values: any[], item) => {
            const found = this.props.values.find((e) => {
                return e.value === item;
            });
            if (found !== null) {
                values.push(found);
            }
            return values;
        }, []);
    };

    getOptionLabel = ({text}: {text:string}) => text; 

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
