// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {CSSProperties} from 'react';
import debounce from 'lodash/debounce';

import LoadingScreen from 'components/loading_screen';

const SCROLL_BUFFER = 100;
const DEBOUNCE_WAIT_TIME = 200;

type Props = {
    children: React.ReactNode;

    /**
     * Function that is called to load more items
     */
    callBack: () => void;

    /**
     * Message to display when all the data has been scrolled through
     */
    endOfDataMessage?: string;

    /**
     * A wrapper class to define styling of the infinite scroll
     */
    styleClass?: string;

    /**
     * A number that determines how far the scroll is near the bottom before
     * loading more items. The bigger this value the more items will be loaded
     * much earlier as you scroll to the bottom.
     */
    bufferValue: number;

    /**
     * The total number of items to be scrolled through
     */
    totalItems: number;

    /**
     * The number of items to load in a single fetch
     */
    itemsPerPage: number;

    /**
     * The current page that has been scrolled to
     */
    pageNumber: number;

    /**
     * Optional style object that's passed on to the underlying loader
     * component
     */

    loaderStyle?: CSSProperties;
};

type State = {
    isFetching: boolean;
    isEndofData: boolean;
};

export default class InfiniteScroll extends React.PureComponent<Props, State> {
    node: React.RefObject<HTMLDivElement>;

    static defaultProps = {
        bufferValue: SCROLL_BUFFER,
        endOfDataMessage: '',
        styleClass: '',
        loaderStyle: {},
    };

    constructor(props: Props) {
        super(props);
        this.state = {
            isFetching: false,
            isEndofData: false,
        };
        this.node = React.createRef();
    }

    componentDidMount(): void {
        this.node.current?.addEventListener('scroll', this.debounceHandleScroll);
    }

    componentWillUnmount(): void {
        this.node.current?.removeEventListener('scroll', this.debounceHandleScroll);
    }

    validateBuffer = (buffer: number): number => {
        if (buffer < SCROLL_BUFFER) {
            return SCROLL_BUFFER;
        }
        return Math.abs(buffer);
    };

    getAmountOfPages = (total: number, freq: number): number => {
        return Math.ceil(total / freq);
    };

    handleScroll = (): void => {
        const {isFetching, isEndofData} = this.state;
        const {callBack, bufferValue, totalItems, itemsPerPage, pageNumber} = this.props;

        const node = this.node.current;
        const validBuffer = this.validateBuffer(bufferValue);

        const toScroll = node!.scrollHeight - node!.clientHeight - validBuffer;
        const nearBottom = node!.scrollTop > toScroll;

        if (nearBottom && !isEndofData && !isFetching) {
            this.setState({isFetching: true},
                async () => {
                    await callBack();

                    this.setState({
                        isFetching: false,
                    });

                    if (totalItems === 0) {
                        this.setState({
                            isEndofData: true,
                        });
                        return;
                    }

                    const amountOfPages = this.getAmountOfPages(totalItems, itemsPerPage);

                    if (pageNumber === amountOfPages) {
                        this.setState({
                            isEndofData: true,
                        });
                    }
                });
        }
    };

    debounceHandleScroll = debounce(this.handleScroll, DEBOUNCE_WAIT_TIME);

    render(): React.ReactNode {
        const {children, endOfDataMessage, styleClass, loaderStyle} = this.props;
        const {isEndofData, isFetching} = this.state;
        const showLoader = !isEndofData && isFetching; // show loader if fetching and end of data is not reached.
        return (
            <>
                <div
                    className={`infinite-scroll ${styleClass}`}
                    ref={this.node}
                >
                    {children}
                    {showLoader && (
                        <LoadingScreen
                            style={loaderStyle}
                            message=' '
                        />
                    )}
                    {!showLoader && endOfDataMessage}
                </div>
            </>
        );
    }
}
