// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import MultiSelectList from './multiselect_list.jsx';

import {localizeMessage} from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
const KeyCodes = Constants.KeyCodes;

import React from 'react';
import ReactSelect from 'react-select';
import {FormattedMessage} from 'react-intl';

export default class MultiSelect extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.onSelect = this.onSelect.bind(this);
        this.onAdd = this.onAdd.bind(this);
        this.onInput = this.onInput.bind(this);
        this.handleEnterPress = this.handleEnterPress.bind(this);

        this.selected = null;
    }

    componentDidMount() {
        document.addEventListener('keydown', this.handleEnterPress);
        this.refs.select.focus();
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleEnterPress);
    }

    onSelect(selected) {
        this.selected = selected;
    }

    onAdd(value) {
        if (this.props.maxValues && this.props.values.length >= this.props.maxValues) {
            return;
        }

        for (let i = 0; i < this.props.values.length; i++) {
            if (this.props.values[i].value === value.value) {
                return;
            }
        }

        this.props.handleAdd(value);
        this.selected = null;
    }

    onInput(input) {
        if (input === '') {
            this.refs.list.setSelected(-1);
        } else {
            this.refs.list.setSelected(0);
        }
        this.selected = null;

        this.props.handleInput(input);
    }

    handleEnterPress(e) {
        switch (e.keyCode) {
        case KeyCodes.ENTER:
            if (this.selected == null) {
                this.props.handleSubmit();
                return;
            }
            this.onAdd(this.selected);
            this.onInput('');
            break;
        }
    }

    onChange(values) {
        if (values.length < this.props.values.length) {
            this.props.handleDelete(values);
        }
    }

    render() {
        let numRemainingText;
        if (this.props.maxValues != null) {
            numRemainingText = (
                <FormattedMessage
                    id='multiselect.numRemaining'
                    defaultMessage='You can add {num, number} more'
                    values={{
                        num: this.props.maxValues - this.props.values.length
                    }}
                />
            );
        }

        return (
            <div>
                <div style={{width: '90%', display: 'inline-block'}}>
                    <ReactSelect
                        ref='select'
                        multi={true}
                        options={this.props.options}
                        joinValues={true}
                        clearable={false}
                        openOnFocus={true}
                        onInputChange={this.onInput}
                        onBlurResetsInput={false}
                        onChange={this.onChange}
                        value={this.props.values}
                        valueRenderer={this.props.valueRenderer}
                        menuRenderer={() => null}
                        arrowRenderer={() => null}
                        noResultsText={null}
                        placeholder={localizeMessage('multiselect.placeholder', 'Search and add members')}
                    />
                </div>
                <button
                    className='btn btn-primary btn-sm'
                    style={{display: 'inline-block'}}
                    onClick={this.props.handleSubmit}
                >
                    <FormattedMessage
                        id='multiselect.go'
                        defaultMessage='Go'
                    />
                </button>
                <FormattedMessage
                    id='multiselect.instructions'
                    defaultMessage='Use up/down arrows to navigate and enter to select'
                />
                <br/>
                {numRemainingText}
                {this.props.noteText}
                <MultiSelectList
                    ref='list'
                    options={this.props.options}
                    optionRenderer={this.props.optionRenderer}
                    perPage={this.props.perPage}
                    onPageChange={this.props.handlePageChange}
                    onAdd={this.onAdd}
                    onSelect={this.onSelect}
                />
            </div>
        );
    }
}

MultiSelect.propTypes = {
    options: React.PropTypes.arrayOf(React.PropTypes.object),
    optionRenderer: React.PropTypes.func,
    values: React.PropTypes.arrayOf(React.PropTypes.object),
    valueRenderer: React.PropTypes.func,
    handleInput: React.PropTypes.func,
    handleDelete: React.PropTypes.func,
    perPage: React.PropTypes.number,
    handlePageChange: React.PropTypes.func,
    handleAdd: React.PropTypes.func,
    handleSubmit: React.PropTypes.func,
    noteText: React.PropTypes.node,
    maxValues: React.PropTypes.number
};
