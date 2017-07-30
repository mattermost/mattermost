// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import MultiSelectList from './multiselect_list.jsx';

import {localizeMessage} from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
const KeyCodes = Constants.KeyCodes;

import PropTypes from 'prop-types';

import React from 'react';
import ReactSelect from 'react-select';
import {FormattedMessage} from 'react-intl';

export default class MultiSelect extends React.Component {
    constructor(props) {
        super(props);

        this.selected = null;

        this.state = {
            page: 0
        };
    }

    componentDidMount() {
        document.addEventListener('keydown', this.handleEnterPress);
        this.refs.select.focus();
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleEnterPress);
    }

    nextPage = () => {
        if (this.props.handlePageChange) {
            this.props.handlePageChange(this.state.page + 1, this.state.page);
        }
        this.refs.list.setSelected(0);
        this.setState({page: this.state.page + 1});
    }

    prevPage = () => {
        if (this.state.page === 0) {
            return;
        }

        if (this.props.handlePageChange) {
            this.props.handlePageChange(this.state.page - 1, this.state.page);
        }
        this.refs.list.setSelected(0);
        this.setState({page: this.state.page - 1});
    }

    resetPaging = () => {
        this.setState({page: 0});
    }

    onSelect = (selected) => {
        this.selected = selected;
    }

    onAdd = (value) => {
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
        this.refs.select.handleInputChange({target: {value: ''}});
        this.onInput('');
        this.refs.select.focus();
    }

    onInput = (input) => {
        if (input === '') {
            this.refs.list.setSelected(-1);
        } else {
            this.refs.list.setSelected(0);
        }
        this.selected = null;

        this.props.handleInput(input);
    }

    handleEnterPress = (e) => {
        switch (e.keyCode) {
        case KeyCodes.ENTER:
            if (this.selected == null) {
                this.props.handleSubmit();
                return;
            }
            this.onAdd(this.selected);
            break;
        }
    }

    onChange = (values) => {
        if (values.length < this.props.values.length) {
            this.props.handleDelete(values);
        }
    }

    render() {
        const options = Object.assign([], this.props.options);
        const values = this.props.values;

        let numRemainingText;
        if (this.props.numRemainingText) {
            numRemainingText = this.props.numRemainingText;
        } else if (this.props.maxValues != null) {
            numRemainingText = (
                <FormattedMessage
                    id='multiselect.numRemaining'
                    defaultMessage='You can add {num, number} more. '
                    values={{
                        num: this.props.maxValues - this.props.values.length
                    }}
                />
            );
        }

        let buttonSubmitText;
        if (this.props.buttonSubmitText) {
            buttonSubmitText = this.props.buttonSubmitText;
        } else if (this.props.maxValues != null) {
            buttonSubmitText = (
                <FormattedMessage
                    id='multiselect.go'
                    defaultMessage='Go'
                />
            );
        }

        let optionsToDisplay = [];
        let nextButton;
        let previousButton;
        let noteTextContainer;

        if (this.props.noteText) {
            noteTextContainer = (
                <div className='multi-select__note'>
                    <div className='note__icon'><span className='fa fa-info'/></div>
                    <div>{this.props.noteText}</div>
                </div>
            );
        }

        const valueMap = {};
        for (let i = 0; i < values.length; i++) {
            valueMap[values[i].id] = true;
        }

        for (let i = options.length - 1; i >= 0; i--) {
            if (valueMap[options[i].id]) {
                options.splice(i, 1);
            }
        }

        if (options && options.length > this.props.perPage) {
            const pageStart = this.state.page * this.props.perPage;
            const pageEnd = pageStart + this.props.perPage;
            optionsToDisplay = options.slice(pageStart, pageEnd);

            if (options.length > pageEnd) {
                nextButton = (
                    <button
                        className='btn btn-default filter-control filter-control__next'
                        onClick={this.nextPage}
                    >
                        <FormattedMessage
                            id='filtered_user_list.next'
                            defaultMessage='Next'
                        />
                    </button>
                );
            }

            if (this.state.page > 0) {
                previousButton = (
                    <button
                        className='btn btn-default filter-control filter-control__prev'
                        onClick={this.prevPage}
                    >
                        <FormattedMessage
                            id='filtered_user_list.prev'
                            defaultMessage='Previous'
                        />
                    </button>
                );
            }
        } else {
            optionsToDisplay = options;
        }

        return (
            <div className='filtered-user-list'>
                <div className='filter-row filter-row--full'>
                    <div className='multi-select__container'>
                        <ReactSelect
                            ref='select'
                            multi={true}
                            options={this.props.options}
                            joinValues={true}
                            clearable={false}
                            openOnFocus={true}
                            onInputChange={this.onInput}
                            onBlurResetsInput={false}
                            onCloseResetsInput={false}
                            onChange={this.onChange}
                            value={this.props.values}
                            valueRenderer={this.props.valueRenderer}
                            menuRenderer={() => null}
                            arrowRenderer={() => null}
                            noResultsText={null}
                            placeholder={localizeMessage('multiselect.placeholder', 'Search and add members')}
                        />
                        <button
                            className='btn btn-primary btn-sm'
                            onClick={this.props.handleSubmit}
                        >
                            {buttonSubmitText}
                        </button>
                    </div>
                    <div className='multi-select__help'>
                        {numRemainingText}
                        {noteTextContainer}
                    </div>
                </div>
                <MultiSelectList
                    ref='list'
                    options={optionsToDisplay}
                    optionRenderer={this.props.optionRenderer}
                    page={this.state.page}
                    perPage={this.props.perPage}
                    onPageChange={this.props.handlePageChange}
                    onAdd={this.onAdd}
                    onSelect={this.onSelect}
                />
                <div className='filter-controls'>
                    {previousButton}
                    {nextButton}
                </div>
            </div>
        );
    }
}

MultiSelect.propTypes = {
    options: PropTypes.arrayOf(PropTypes.object),
    optionRenderer: PropTypes.func,
    values: PropTypes.arrayOf(PropTypes.object),
    valueRenderer: PropTypes.func,
    handleInput: PropTypes.func,
    handleDelete: PropTypes.func,
    perPage: PropTypes.number,
    handlePageChange: PropTypes.func,
    handleAdd: PropTypes.func,
    handleSubmit: PropTypes.func,
    noteText: PropTypes.node,
    maxValues: PropTypes.number,
    numRemainingText: PropTypes.node,
    buttonSubmitText: PropTypes.node
};
