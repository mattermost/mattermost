// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import classNames from 'classnames';

import FilterList from './filter_list';
import './filter.scss';

export type Filters = {
    [filterKey: string]: string[];
};

export type FilterValue = {
    name: string | JSX.Element;
    value: boolean | string | string[];
};

export type FilterValues = {
    [key: string]: FilterValue;
};

export type FilterOption = {

    // Display name of the filter option eg. 'Channels', 'Roles' or <FormattedMessage .../>
    name: string | JSX.Element;

    // List of keys that match the filter values, used to define the order in which the filters appear
    keys: string[];

    // Key value map of filter values with keys matching the keys above
    values: FilterValues;

    // Filter Component type, optional parameter defaults to FilterCheckbox
    type?: React.ElementType;
}

export type FilterOptions = {
    [key: string]: FilterOption;
}

type Props = {
    onFilter: (filters: FilterOptions) => void;
    options: FilterOptions;
    keys: string[];
}

type State = {
    show: boolean;
    options: FilterOptions;
    keys: string[];
    optionsModified: boolean;
    filterCount: number;
}

class Filter extends React.PureComponent<Props, State> {
    private buttonRef: React.RefObject<HTMLButtonElement>;
    private filterRef: React.RefObject<HTMLDivElement>;

    public constructor(props: Props) {
        super(props);

        let options = {...props.options};
        let keys = [...props.keys];
        let valid = true;
        keys.forEach((key) => {
            const option = options[key];
            if (option && valid) {
                option.keys.forEach((optionKey) => {
                    if (!option.values[optionKey]) {
                        valid = false;
                    }
                });
            } else {
                valid = false;
            }
        });

        if (!valid) {
            options = {};
            keys = [];
        }

        this.state = {
            show: false,
            options,
            keys,
            optionsModified: false,
            filterCount: 0,
        };

        this.filterRef = React.createRef();
        this.buttonRef = React.createRef();
    }

    componentDidMount = () => {
        document.addEventListener('mousedown', this.handleClickOutside);
    };

    componentWillUnmount = () => {
        document.removeEventListener('mousedown', this.handleClickOutside);
    };

    handleClickOutside = (event: MouseEvent) => {
        if (this.filterRef?.current?.contains(event.target as Node)) {
            return;
        }
        this.hidePopover();
    };

    hidePopover = () => {
        this.setState({show: false});
        this.buttonRef?.current?.blur();
    };

    togglePopover = () => {
        if (this.state.show) {
            this.hidePopover();
            return;
        }

        this.setState({show: true});
    };

    updateValues = async (values: FilterValues, optionKey: string) => {
        const options = {
            ...this.state.options,
            [optionKey]: {
                ...this.state.options[optionKey],
                values: {
                    ...values,
                },
            },
        };
        this.setState({options, optionsModified: true});
    };

    onFilter = () => {
        this.props.onFilter(this.state.options);
        this.setState({optionsModified: false, show: false, filterCount: this.calculateFilterCount()});
    };

    calculateFilterCount = () => {
        const options = this.state.options;
        let filterCount = 0;
        this.props.keys.forEach((key) => {
            const {values, keys} = options[key];
            keys.forEach((filterKey: string) => {
                if (values[filterKey].value instanceof Array) {
                    filterCount += (values[filterKey].value as string[]).length;
                } else if (values[filterKey].value) {
                    filterCount += 1;
                }
            });
        });
        return filterCount;
    };

    resetFilters = () => {
        this.setState({options: {...this.props.options}}, this.onFilter);
    };

    renderFilterOptions = () => {
        const {keys, options} = this.state;
        return keys.map((key: string) => {
            const filter = options[key];
            const FilterListComponent = filter.type || FilterList;

            return (
                <FilterListComponent
                    option={filter}
                    optionKey={key}
                    updateValues={this.updateValues}
                    key={key}
                />
            );
        });
    };

    render() {
        const filters = this.renderFilterOptions();
        const {filterCount} = this.state;

        return (
            <div
                className='Filter'
                ref={this.filterRef}
            >
                <button
                    type='button'
                    className={classNames('Filter_button', {Filter__active: this.state.show})}
                    onClick={this.togglePopover}
                    ref={this.buttonRef}
                >
                    <i className='Icon icon-filter-variant'/>

                    <FormattedMessage
                        id='admin.filter.filters'
                        defaultMessage='Filters'
                    />
                    {filterCount > 0 && ` (${filterCount})`}
                </button>

                <div
                    className={classNames('Filter_content', {Filter__show: this.state.show})}
                >
                    <div className='Filter_header'>
                        <div className='Filter_title'>
                            <FormattedMessage
                                id='admin.filter.title'
                                defaultMessage='Filter by'
                            />
                        </div>

                        <a
                            className='Filter_reset'
                            onClick={this.resetFilters}
                        >
                            <FormattedMessage
                                id='admin.filter.reset'
                                defaultMessage='Reset filters'
                            />
                        </a>
                    </div>

                    <hr/>

                    <div className='Filter_lists'>
                        {filters}
                    </div>

                    <button
                        type='button'
                        className='Filter_apply style--none btn btn-primary'
                        disabled={!this.state.optionsModified}
                        onClick={this.onFilter}
                    >
                        <FormattedMessage
                            id='admin.filter.apply'
                            defaultMessage='Apply'
                        />
                    </button>
                </div>
            </div>
        );
    }
}

export default Filter;
