// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import LoadingScreen from 'components/loading_screen';

import type {Group} from '@mattermost/types/groups';

export const DEFAULT_NUM_PER_PAGE = 50;

type Props = {

    /**
     * titleText (optional) a string to show at the top bar of the modal.
     */
    titleText?: string;

    /**
     * searchPlaceholderText (optional) a string to show as a placeholder in the search input.
     */
    searchPlaceholderText?: string;

    /**
     * titleBarButtonText (optional) a string representing a title bar button text.
     */
    titleBarButtonText?: string;

    /**
     * numPerPage (optional) a number setting how many items per page should be displayed. Defaults to
     * DEFAULT_NUM_PER_PAGE.
     */
    numPerPage?: number;

    /**
     * show (optional) a boolean setting to hide the modal via props rather then unmounting it.
     */
    show?: boolean;

    /**
     * titleBarButtonOnClick (optional) a func to handle title button bar clicks.
     */
    titleBarButtonOnClick?: () => void;

    /**
     * loadItems is a function that receives the params (pageNumber, searchTerm) and should return an object
     * with the shape {items: [], totalCount: 0}.
     * items: an array of objects that are passed to each renderRow function.
     * totalCount: an integer representing the total number of items as displayed in the pagination text.
     *
     * Example:
     *     const loadItems = async (pageNumber, searchTerm) => {
     *         const {data} = await loadFromServer(searchTerm, pageNumber, PER_PAGE);
     *         return {
     *             items: data.users,
     *             totalCount: data.total,
     *         };
     *     };
     */
    loadItems: (page: number, searchTerm: string) => Promise<{
        items: Group[];
        totalCount: number;
    }>;

    /**
     * onHide (optional) a function to be invoked when the modal is closed.
     */
    onHide?: () => void;

    /**
     * renderRow is a function that receives the params (item, listModal) and should return JSX.
     * item: an object as returned by each entry in the loadItems function's 'items' array.
     * listModal: the instance of the ListModal component class.
     *
     * Example:
     *     const renderRow = (item, listModal) => <div>{item.id}</div>;
     */
    renderRow: (item: Group, listModal: ListModal) => JSX.Element;
}

type State = {
    show: boolean;
    page: number;
    items: Group[];
    totalCount: number;
    loading: boolean;
    searchTerm: string;
}

export default class ListModal extends React.PureComponent<Props, State> {
    static defaultProps = {
        show: true,
    };
    numPerPage: number;

    constructor(props: Props) {
        super(props);

        this.numPerPage = props.numPerPage || DEFAULT_NUM_PER_PAGE;

        this.state = {
            show: true,
            page: 0,
            items: [],
            totalCount: 0,
            loading: true,
            searchTerm: '',
        };
    }

    async componentDidMount() {
        const {totalCount, items} = await this.props.loadItems(0, '');
        this.setState({totalCount, items, loading: false});
    }

    handleHide = () => {
        this.setState({show: false});
    };

    handleExit = () => {
        if (this.props.onHide) {
            this.props.onHide();
        }
    };

    renderRows() {
        if (this.state.loading) {
            return (
                <div>
                    <LoadingScreen
                        position='absolute'
                        key='loading'
                    />
                </div>
            );
        }
        return this.state.items.map((item) => (
            this.props.renderRow(item, this)
        ));
    }

    onNext = () => {
        const nextPage = this.state.page + 1;
        this.onPageChange(nextPage);
    };

    onPrev = () => {
        const prevPage = this.state.page - 1;
        this.onPageChange(prevPage);
    };

    onPageChange = async (page: number) => {
        this.setState({loading: true});
        const result = await this.props.loadItems(page, this.state.searchTerm);
        this.setState({page, items: result.items, loading: false});
    };

    onSearchInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const {target} = event;
        const searchTerm = target.value;
        this.setState({loading: true, searchTerm});
        const result = await this.props.loadItems(0, searchTerm);
        const {items, totalCount} = result;
        this.setState({loading: false, items, totalCount});
    };

    paginationRange() {
        let startCount = (this.state.page * this.numPerPage) + 1;
        const endCount = (startCount + this.state.items.length) - 1;
        if (endCount === 0) {
            startCount = 0;
        }
        return {startCount, endCount};
    }

    render() {
        if (!this.props.show) {
            return null;
        }
        const {endCount, startCount} = this.paginationRange();
        return (
            <div>
                <Modal
                    dialogClassName='a11y__modal more-modal more-modal--action'
                    show={this.state.show}
                    onHide={this.handleHide}
                    onExited={this.handleExit}
                >
                    <Modal.Header closeButton={true}>
                        <Modal.Title componentClass='h1'>
                            <span className='name'>{this.props.titleText}</span>
                        </Modal.Title>
                        {this.props.titleBarButtonText && this.props.titleBarButtonOnClick &&
                            <a
                                className='btn btn-md btn-primary'
                                href='#'
                                onClick={this.props.titleBarButtonOnClick}
                            >
                                {this.props.titleBarButtonText}
                            </a>}
                    </Modal.Header>
                    <Modal.Body>
                        <div className='filtered-user-list'>
                            <div className='filter-row'>
                                <div className='col-xs-12'>
                                    <label
                                        className='hidden-label'
                                        htmlFor='searchUsersInput'
                                    >
                                        {this.props.searchPlaceholderText}
                                    </label>
                                    <input
                                        id='searchUsersInput'
                                        className='form-control filter-textbox'
                                        placeholder={this.props.searchPlaceholderText}
                                        onChange={this.onSearchInput}
                                    />
                                </div>
                                <div className='col-sm-12'>
                                    <span className='member-count pull-left'>
                                        <FormattedMessage
                                            id='list_modal.paginatorCount'
                                            defaultMessage='{startCount, number} - {endCount, number} of {total, number} total'
                                            values={{
                                                startCount,
                                                endCount,
                                                total: this.state.totalCount,
                                            }}
                                        />
                                    </span>
                                </div>
                            </div>
                            <div className='more-modal__list'>
                                <div>
                                    {this.renderRows()}
                                </div>
                            </div>
                            <div className='filter-controls'>
                                {this.state.page > 0 &&
                                <button
                                    onClick={this.onPrev}
                                    className='btn btn-link filter-control filter-control__prev'
                                >
                                    <FormattedMessage
                                        id='filtered_user_list.prev'
                                        defaultMessage='Previous'
                                    />
                                </button>}
                                {this.props.numPerPage && (this.state.items.length >= this.props.numPerPage) && endCount !== this.state.totalCount &&
                                <button
                                    onClick={this.onNext}
                                    className='btn btn-link filter-control filter-control__next'
                                >
                                    <FormattedMessage
                                        id='filtered_user_list.next'
                                        defaultMessage='Next'
                                    />
                                </button>}
                            </div>
                        </div>
                    </Modal.Body>
                </Modal>
            </div >
        );
    }
}
