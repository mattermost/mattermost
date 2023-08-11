// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';

import PropTypes from 'prop-types';

export default class InfiniteScroll extends PureComponent {
    static propTypes = {
        children: PropTypes.array,
        element: PropTypes.string,
        hasMore: PropTypes.bool,
        initialLoad: PropTypes.bool,
        loader: PropTypes.object,
        loadMore: PropTypes.func.isRequired,
        pageStart: PropTypes.number,
        threshold: PropTypes.number,
        useWindow: PropTypes.bool,
        isReverse: PropTypes.bool,
        containerHeight: PropTypes.number,
        scrollPosition: PropTypes.number,
    };

    static defaultProps = {
        element: 'div',
        hasMore: false,
        initialLoad: true,
        pageStart: 0,
        threshold: 250,
        useWindow: true,
        isReverse: false,
        containerHeight: null,
        scrollPosition: null,
    };

    componentDidMount() {
        this.pageLoaded = this.props.pageStart;
        this.attachScrollListener();
        this.setScrollPosition();
    }

    componentDidUpdate() {
        this.attachScrollListener();
    }

    render() {
        const {
            children,
            element,
            hasMore,
            initialLoad, // eslint-disable-line no-unused-vars
            loader,
            loadMore, // eslint-disable-line no-unused-vars
            pageStart, // eslint-disable-line no-unused-vars
            threshold, // eslint-disable-line no-unused-vars
            useWindow, // eslint-disable-line no-unused-vars
            isReverse, // eslint-disable-line no-unused-vars
            scrollPosition, // eslint-disable-line no-unused-vars
            containerHeight,
            ...props
        } = this.props;

        props.ref = (node) => {
            this.scrollComponent = node;
        };

        const elementProps = containerHeight ? {...props, style: {height: containerHeight}} : props;

        return React.createElement(element, elementProps, children, hasMore && (loader || this.defaultLoader));
    }

    calculateTopPosition(el) {
        if (!el) {
            return 0;
        }
        return el.offsetTop + this.calculateTopPosition(el.offsetParent);
    }

    setScrollPosition() {
        const {scrollPosition} = this.props;
        if (scrollPosition !== null) {
            window.scrollTo(0, scrollPosition);
        }
    }

    scrollListener = () => {
        const el = this.scrollComponent;
        const scrollEl = window;

        let offset;
        if (this.props.useWindow) {
            var scrollTop = ('pageYOffset' in scrollEl) ? scrollEl.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
            if (this.props.isReverse) {
                offset = scrollTop;
            } else {
                offset = this.calculateTopPosition(el) + (el.offsetHeight - scrollTop - window.innerHeight);
            }
        } else if (this.props.isReverse) {
            offset = el.parentNode.scrollTop;
        } else {
            offset = el.scrollHeight - el.parentNode.scrollTop - el.parentNode.clientHeight;
        }

        if (offset < Number(this.props.threshold)) {
            this.detachScrollListener();

            // Call loadMore after detachScrollListener to allow for non-async loadMore functions
            if (typeof this.props.loadMore === 'function') {
                this.props.loadMore(this.pageLoaded += 1);
            }
        }
    };

    attachScrollListener() {
        if (!this.props.hasMore) {
            return;
        }

        let scrollEl = window;
        if (this.props.useWindow === false) {
            scrollEl = this.scrollComponent.parentNode;
        }

        scrollEl.addEventListener('scroll', this.scrollListener);
        scrollEl.addEventListener('resize', this.scrollListener);

        if (this.props.initialLoad) {
            this.scrollListener();
        }
    }

    detachScrollListener() {
        var scrollEl = window;
        if (this.props.useWindow === false) {
            scrollEl = this.scrollComponent.parentNode;
        }

        scrollEl.removeEventListener('scroll', this.scrollListener);
        scrollEl.removeEventListener('resize', this.scrollListener);
    }

    componentWillUnmount() {
        this.detachScrollListener();
    }

    // Set a defaut loader for all your `InfiniteScroll` components
    setDefaultLoader(loader) {
        this.defaultLoader = loader;
    }
}
