// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {CSSProperties} from 'react';
import {FormattedMessage} from 'react-intl';

import {FilterOptions} from 'components/admin_console/filter/filter';
import NextIcon from 'components/widgets/icons/fa_next_icon';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import DataGridHeader from './data_grid_header';
import DataGridRow from './data_grid_row';
import DataGridSearch from './data_grid_search';

import './data_grid.scss';

export type Column = {
    name: string | JSX.Element;
    field: string;
    fixed?: boolean;

    // Optional styling overrides
    className?: string;
    width?: number;
    textAlign?: '-moz-initial' | 'inherit' | 'initial' | 'revert' | 'unset' | 'center' | 'end' | 'justify' | 'left' | 'match-parent' | 'right' | 'start' | undefined;
    overflow?: string;
}

export type Row = {
    cells: {
        [key: string]: JSX.Element | string | null;
    };
    onClick?: () => void;
}

type Props = {
    rows: Row[];
    columns: Column[];
    placeholderEmpty?: JSX.Element;
    loadingIndicator?: JSX.Element;

    rowsContainerStyles?: CSSProperties;

    minimumColumnWidth?: number;

    page: number;
    startCount: number;
    endCount: number;
    total?: number;
    loading: boolean;

    nextPage: () => void;
    previousPage: () => void;

    onSearch?: (term: string) => void;
    term?: string;
    searchPlaceholder?: string;
    extraComponent?: JSX.Element;
    filterProps?: {
        options: FilterOptions;
        keys: string[];
        onFilter: (options: FilterOptions) => void;
    };

    className?: string;
};

type State = {
    visibleColumns: Column[];
    fixedColumns: Column[];
    hiddenColumns: Column[];
    minimumColumnWidth: number;
};

const MINIMUM_COLUMN_WIDTH = 100;

class DataGrid extends React.PureComponent<Props, State> {
    private ref: React.RefObject<HTMLDivElement>;

    static defaultProps = {
        term: '',
        searchPlaceholder: '',
    };

    public constructor(props: Props) {
        super(props);

        const minimumColumnWidth = props.minimumColumnWidth ? props.minimumColumnWidth : MINIMUM_COLUMN_WIDTH;

        this.state = {
            visibleColumns: this.props.columns,
            hiddenColumns: [],
            fixedColumns: this.props.columns.filter((col) => col.fixed),
            minimumColumnWidth,
        };

        this.ref = React.createRef();
    }

    componentDidMount() {
        this.handleResize();
        window.addEventListener('resize', this.handleResize);
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.columns !== prevProps.columns) {
            this.setState({visibleColumns: this.props.columns});
        }
    }
    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }

    private handleResize = () => {
        if (!this.ref?.current) {
            return;
        }

        const {minimumColumnWidth, fixedColumns} = this.state;
        const fixedColumnWidth = (fixedColumns.length * minimumColumnWidth);

        let visibleColumns: Column[] = this.props.columns;
        let availableWidth = this.ref.current.clientWidth - fixedColumnWidth - 50;

        visibleColumns = visibleColumns.filter((column) => {
            if (availableWidth > minimumColumnWidth) {
                availableWidth -= minimumColumnWidth;
                return true;
            }

            return Boolean(column.fixed);
        });

        this.setState({visibleColumns});
    };

    private renderRows(): JSX.Element {
        const {rows, rowsContainerStyles} = this.props;
        const {visibleColumns} = this.state;
        let rowsToRender: JSX.Element | JSX.Element[] | null = null;

        if (this.props.loading) {
            if (this.props.loadingIndicator) {
                rowsToRender = (
                    <div className='DataGrid_loading'>
                        {this.props.loadingIndicator}
                    </div>
                );
            } else {
                rowsToRender = (
                    <div className='DataGrid_loading'>
                        <LoadingSpinner/>
                        <FormattedMessage
                            id='admin.data_grid.loading'
                            defaultMessage='Loading'
                        />
                    </div>
                );
            }
        } else if (rows.length === 0) {
            const placeholder = this.props.placeholderEmpty || (
                <FormattedMessage
                    id='admin.data_grid.empty'
                    defaultMessage='No items found'
                />
            );
            rowsToRender = (
                <div className='DataGrid_empty'>
                    {placeholder}
                </div>
            );
        } else {
            rowsToRender = rows.map((row, index) => {
                return (
                    <DataGridRow
                        key={index}
                        row={row}
                        columns={visibleColumns}
                    />
                );
            });
        }
        return (
            <div
                className='DataGrid_rows'
                style={rowsContainerStyles || {}}
            >
                {rowsToRender}
            </div>
        );
    }

    private renderHeader(): JSX.Element {
        return (
            <DataGridHeader
                columns={this.state.visibleColumns}
            />
        );
    }

    private renderSearch(): JSX.Element | null {
        if (this.props.onSearch) {
            return (
                <DataGridSearch
                    onSearch={this.search}
                    placeholder={this.props.searchPlaceholder}
                    term={this.props.term}
                    filterProps={this.props.filterProps}
                    extraComponent={this.props.extraComponent}
                />
            );
        }
        return null;
    }

    private nextPage = () => {
        if (!this.props.loading) {
            this.props.nextPage();
        }
    };

    private previousPage = () => {
        if (!this.props.loading) {
            this.props.previousPage();
        }
    };

    private search = (term: string) => {
        if (this.props.onSearch) {
            this.props.onSearch(term);
        }
    };

    private renderFooter = (): JSX.Element | null => {
        const {startCount, endCount, total} = this.props;
        let footer: JSX.Element | null = null;

        if (total) {
            const firstPage = startCount <= 1;
            const lastPage = endCount >= total;

            let prevPageFn: () => void = this.previousPage;
            if (firstPage) {
                prevPageFn = () => {};
            }

            let nextPageFn: () => void = this.nextPage;
            if (lastPage) {
                nextPageFn = () => {};
            }

            footer = (
                <div className='DataGrid_footer'>
                    <div className='DataGrid_cell'>
                        <FormattedMessage
                            id='admin.data_grid.paginatorCount'
                            defaultMessage='{startCount, number} - {endCount, number} of {total, number}'
                            values={{
                                startCount,
                                endCount,
                                total,
                            }}
                        />

                        <button
                            type='button'
                            className={'btn btn-link prev ' + (firstPage ? 'disabled' : '')}
                            onClick={prevPageFn}
                            disabled={firstPage}
                        >
                            <PreviousIcon/>
                        </button>
                        <button
                            type='button'
                            className={'btn btn-link next ' + (lastPage ? 'disabled' : '')}
                            onClick={nextPageFn}
                            disabled={lastPage}
                        >
                            <NextIcon/>
                        </button>
                    </div>
                </div>
            );
        }

        return footer;
    };

    public render() {
        return (
            <div
                className={classNames('DataGrid', this.props.className)}
                ref={this.ref}
            >
                {this.renderSearch()}
                {this.renderHeader()}
                {this.renderRows()}
                {this.renderFooter()}
            </div>
        );
    }
}

export default DataGrid;
