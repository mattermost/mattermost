import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import React from 'react';
import ReactSelect from 'react-select';

import Setting from './setting.jsx';
import FormError from 'components/form_error.jsx';

export default class MultiSelectSetting extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.state = {error: false};
    }

    handleChange(newValue) {
        const values = newValue.map((n) => {
            return n.value;
        });

        if (this.props.selected.length > 0 && this.props.mustBePresent && values.join(',').indexOf(this.props.mustBePresent) === -1) {
            this.setState({error: this.props.notPresent});
        } else {
            this.props.onChange(this.props.id, values);
            this.setState({error: false});
        }
    }

    componentWillReceiveProps(newProps) {
        if (newProps.selected.length > 0 && newProps.mustBePresent && newProps.selected.join(',').indexOf(newProps.mustBePresent) === -1) {
            this.setState({error: this.props.notPresent});
        } else {
            this.setState({error: false});
        }
    }

    render() {
        return (
            <Setting
                label={this.props.label}
                inputId={this.props.id}
                helpText={this.props.helpText}
            >
                <ReactSelect
                    id={this.props.id}
                    multi={true}
                    labelKey='text'
                    options={this.props.values}
                    joinValues={true}
                    clearable={false}
                    disabled={this.props.disabled}
                    noResultsText={this.props.noResultText}
                    onChange={this.handleChange}
                    value={this.props.selected}
                />
                <FormError error={this.state.error}/>
            </Setting>
        );
    }
}

MultiSelectSetting.defaultProps = {
    disabled: false
};

MultiSelectSetting.propTypes = {
    id: PropTypes.string.isRequired,
    values: PropTypes.array.isRequired,
    label: PropTypes.node.isRequired,
    selected: PropTypes.array.isRequired,
    mustBePresent: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    helpText: PropTypes.node,
    noResultText: PropTypes.node,
    errorText: PropTypes.node,
    notPresent: PropTypes.node
};
