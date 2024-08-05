// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SuggestionList from 'components/suggestion/suggestion_list';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface SuggestionItem {}

type SuggestionListProps = {
    ariaLiveRef?: React.RefObject<HTMLDivElement>;
    renderDividers?: string[];
    renderNoResults?: boolean;
    preventClose?: () => void;
    onItemHover: (term: string) => void;
    onCompleteWord: (term: string, matchedPretext: string, e?: React.KeyboardEventHandler<HTMLDivElement>) => boolean;
    pretext: string;
    matchedPretext: string[];
    items: SuggestionItem[];
    terms: string[];
    selection: string;
    components: Array<React.FunctionComponent<any>>;
    wrapperHeight?: number;

    // suggestionBoxAlgn is an optional object that can be passed to align the SuggestionList with the keyboard caret
    // as the user is typing.
    suggestionBoxAlgn?: {
        lineHeight: number;
        pixelsToMoveX: number;
        pixelsToMoveY: number;
    };
}

type Props = SuggestionListProps & {
    open: boolean;
    cleared: boolean;
    inputRef: React.RefObject<HTMLInputElement>;
    onLoseVisibility: () => void;
    position?: 'top' | 'bottom';
};

type State = {
    scroll: number;
    modalBounds: {top: number; bottom: number};
    inputBounds: {top: number; bottom: number; width: number};
    position: 'top' | 'bottom' | undefined;
    open?: boolean;
    cleared?: boolean;
}

export default class ModalSuggestionList extends React.PureComponent<Props, State> {
    container: React.RefObject<HTMLDivElement>;
    latestHeight: number;
    suggestionList: React.RefObject<any>;

    constructor(props: Props) {
        super(props);

        this.state = {
            scroll: 0,
            modalBounds: {top: 0, bottom: 0},
            inputBounds: {top: 0, bottom: 0, width: 0},
            position: props.position,
        };

        this.container = React.createRef();
        this.suggestionList = React.createRef();
        this.latestHeight = 0;
    }

    calculateInputRect = () => {
        if (this.props.inputRef.current) {
            const rect = this.props.inputRef.current.getBoundingClientRect();
            return {top: rect.top, bottom: rect.bottom, width: rect.width};
        }
        return {top: 0, bottom: 0, width: 0};
    };

    onModalScroll = (e: Event) => {
        const eventTarget = e.target as HTMLElement;
        if (this.state.scroll !== eventTarget.scrollTop &&
            this.latestHeight !== 0) {
            this.setState({scroll: eventTarget.scrollTop});
        }
    };

    componentDidMount() {
        if (this.container.current) {
            const modalBodyContainer = this.container.current.closest('.modal-body');
            modalBodyContainer?.addEventListener('scroll', this.onModalScroll);
        }
        window.addEventListener('resize', this.updateModalBounds);
    }

    componentWillUnmount() {
        if (this.container.current) {
            const modalBodyContainer = this.container.current.closest('.modal-body');
            modalBodyContainer?.removeEventListener('scroll', this.onModalScroll);
        }
        window.removeEventListener('resize', this.updateModalBounds);
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (!this.props.open || this.props.cleared) {
            return;
        }

        if (prevProps.open !== this.state.open ||
            prevProps.cleared !== this.state.cleared ||
            prevState.scroll !== this.state.scroll ||
            prevState.modalBounds.top !== this.state.modalBounds.top ||
            prevState.modalBounds.bottom !== this.state.modalBounds.bottom) {
            const newInputBounds = this.updateInputBounds();
            this.updatePosition(newInputBounds);

            if (this.container.current) {
                const modalBodyContainer = this.container.current.closest('.modal-body');
                const modalBodyRect = modalBodyContainer?.getBoundingClientRect();
                if (modalBodyRect && ((newInputBounds.bottom < modalBodyRect.top) || (newInputBounds.top > modalBodyRect.bottom))) {
                    this.props.onLoseVisibility();
                    return;
                }
            }

            this.updateModalBounds();
        }
    }

    getChildHeight = () => {
        if (!this.container.current) {
            return 0;
        }

        const listElement = this.suggestionList?.current?.getContent()?.[0];
        if (!listElement) {
            return 0;
        }

        return listElement.getBoundingClientRect().height;
    };

    updateInputBounds = () => {
        const inputBounds = this.calculateInputRect();
        if (inputBounds.top !== this.state.inputBounds.top ||
            inputBounds.bottom !== this.state.inputBounds.bottom ||
            inputBounds.width !== this.state.inputBounds.width) {
            this.setState({inputBounds});
        }
        return inputBounds;
    };

    updatePosition = (newInputBounds: { top: number; bottom: number; width: number}) => {
        let inputBounds = newInputBounds;
        if (!newInputBounds) {
            inputBounds = this.state.inputBounds;
        }

        if (!this.container.current) {
            return;
        }

        this.latestHeight = this.getChildHeight();

        let newPosition = this.props.position;
        if (window.innerHeight < inputBounds.bottom + this.latestHeight) {
            newPosition = 'top';
        }
        if (inputBounds.top - this.latestHeight < 0) {
            newPosition = 'bottom';
        }

        if (this.state.position !== newPosition) {
            this.setState({position: newPosition});
        }
    };

    updateModalBounds = () => {
        if (!this.container.current) {
            return;
        }

        const modalBodyContainer = this.container.current.closest('.modal-body');
        const modalBounds = modalBodyContainer?.getBoundingClientRect();

        if (modalBounds) {
            if (this.state.modalBounds.top !== modalBounds.top || this.state.modalBounds.bottom !== modalBounds.bottom) {
                this.setState({modalBounds: {top: modalBounds.top, bottom: modalBounds.bottom}});
            }
        }
    };

    render() {
        const {
            ...props
        } = this.props;

        Reflect.deleteProperty(props, 'onLoseVisibility');

        let position = {};
        if (this.state.position === 'top') {
            position = {bottom: this.state.modalBounds.bottom - this.state.inputBounds.top};
        }

        return (
            <div
                style={{position: 'absolute', zIndex: 101, width: this.state.inputBounds.width, ...position}}
                ref={this.container}
            >
                <SuggestionList
                    {...props}
                    position={this.state.position}
                    ref={this.suggestionList}
                />
            </div>
        );
    }
}
