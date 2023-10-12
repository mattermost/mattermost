import React, { PureComponent, ReactElement } from 'react';

type BaseElementProps = {
    className?: string;
}

interface InfiniteScrollDefaultProps {
    children: React.ReactNode;
    element: keyof JSX.IntrinsicElements;
    hasMore: boolean;
    initialLoad?: boolean;
    loader?: ReactElement;
    loadMore: (page: number) => void;
    pageStart?: number;
    threshold?: number;
    useWindow?: boolean;
    isReverse?: boolean;
    containerHeight?: number | null;
    scrollPosition?: number | null;
}

type InfiniteScrollProps = BaseElementProps & InfiniteScrollDefaultProps & {
    children: React.ReactNode;
    loader?: React.ReactNode;
    loadMore: (page: number) => void;
}

type InfiniteScrollElementProps = BaseElementProps & {
    ref: (node: HTMLElement) => void;
}

export default class InfiniteScroll extends PureComponent<InfiniteScrollProps> {
    static defaultProps: Partial<InfiniteScrollProps> = {
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

    private scrollComponent: HTMLElement | any;
    private pageLoaded: number = this.props.pageStart || 0;
    private defaultLoader: ReactElement | null = null;

    componentDidMount() {
        this.attachScrollListener();
        this.setScrollPosition();
    }

    componentDidUpdate() {
        this.attachScrollListener();
    }

    calculateTopPosition(el: HTMLElement | null): number {
        if (!el) {
            return 0;
        }
        return el.offsetTop + (el.offsetParent ? this.calculateTopPosition(el.offsetParent as HTMLElement) : 0);
    }

    setScrollPosition() {
        const { scrollPosition } = this.props;
        if (scrollPosition !== null && scrollPosition !== undefined) {
            window.scrollTo(0, scrollPosition);
        }
    }

    scrollListener = () => {
        const el = this.scrollComponent;
        const scrollEl = window;

        let offset;
        if (this.props.useWindow) {
            const scrollTop = ('pageYOffset' in scrollEl) ? scrollEl.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
            if (this.props.isReverse) {
                offset = scrollTop;
            } else {
                offset = (el ? this.calculateTopPosition(el) + (el.offsetHeight - scrollTop - window.innerHeight) : 0);
            }
        } else if (this.props.isReverse) {
            offset = el ? el.parentNode!.scrollTop : 0;
        } else {
            offset = el ? (el.scrollHeight - el.parentNode!.scrollTop - el.parentNode!.clientHeight) : 0;
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
        if (this.props.useWindow === false && this.scrollComponent) {
            scrollEl = this.scrollComponent.parentNode;
        }

        scrollEl.addEventListener('scroll', this.scrollListener);
        scrollEl.addEventListener('resize', this.scrollListener);

        if (this.props.initialLoad) {
            this.scrollListener();
        }
    }

    detachScrollListener() {
        let scrollEl = window;
        if (this.props.useWindow === false && this.scrollComponent) {
            scrollEl = this.scrollComponent.parentNode;
        }

        scrollEl.removeEventListener('scroll', this.scrollListener);
        scrollEl.removeEventListener('resize', this.scrollListener);
    }

    componentWillUnmount() {
        this.detachScrollListener();
    }

    // Set a default loader for all your `InfiniteScroll` components
    setDefaultLoader(loader: ReactElement) {
        this.defaultLoader = loader;
    }

    render() {
        const { children, element, hasMore, loader, containerHeight, className, } = this.props;
        const baseElementProps: InfiniteScrollElementProps = {
            ref: (node) => { this.scrollComponent = node; }, className
        };
        const elementProps = containerHeight
            ? { ...baseElementProps, style: { height: containerHeight } }
            : baseElementProps;
        return React.createElement(element, elementProps, children, hasMore && (loader || this.defaultLoader));
    }
}
