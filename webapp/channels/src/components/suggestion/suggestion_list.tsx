// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';
import {cloneDeep} from 'lodash';

import {Constants} from 'utils/constants';

import {isEmptyObject} from 'utils/utils';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

// When this file is migrated to TypeScript, type definitions for its props already exist in ./suggestion_list.d.ts.

interface Props {
    ariaLiveRef?: React.Ref<HTMLDivElement>;
    inputRef?: React.Ref<HTMLInputElement>;
    open: boolean;
    position?: 'top' | 'bottom';
    renderDividers?: string[];
    renderNoResults?: boolean;
    onCompleteWord: (term: string, matchedPretext: string, e?: React.KeyboardEventHandler<HTMLDivElement>) => boolean;
    preventClose?: () => void;
    onItemHover: (term: string) => void;
    pretext: string;
    cleared: boolean;
    matchedPretext: string[];
    items: any[];
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

export default class SuggestionList extends React.PureComponent<Props> {
    static defaultProps = {
        renderDividers: [],
        renderNoResults: false,
    };
    contentRef: React.RefObject<HTMLDivElement>;
    wrapperRef: React.RefObject<HTMLDivElement>;
    itemRefs: Map<any, any>;
    currentLabel: string | null;
    currentItem: any;
    maxHeight: number;

    constructor(props: Props) {
        super(props);

        this.contentRef = React.createRef();
        this.wrapperRef = React.createRef();
        this.itemRefs = new Map();
        this.currentLabel = '';
        this.currentItem = {};
        this.maxHeight = 0;
    }

    componentDidMount() {
        this.updateMaxHeight();
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.selection !== prevProps.selection && this.props.selection) {
            this.scrollToItem(this.props.selection);
        }

        if (!isEmptyObject(this.currentItem)) {
            this.generateLabel(this.currentItem);
        }

        if (this.props.items.length > 0 && prevProps.items.length === 0) {
            this.updateMaxHeight();
        }
    }

    componentWillUnmount() {
        this.removeLabel();
    }

    updateMaxHeight = () => {
        if (!this.props.inputRef) {
            return;
        }

        //const inputElement = (this.props.inputRef as React.RefObject<HTMLInputElement>).current;
        const inputHeight = (this.props.inputRef as React.RefObject<HTMLInputElement>).current!.clientHeight ?? 0;

        this.maxHeight = Math.min(
            window.innerHeight - (inputHeight + Constants.POST_MODAL_PADDING),
            Constants.SUGGESTION_LIST_MAXHEIGHT,
        );

        if (this.contentRef.current) {
            this.contentRef.current.style.maxHeight = `${this.maxHeight}px`;
        }
    };

    announceLabel() {
        const suggestionReadOut = (this.props.ariaLiveRef as React.RefObject<HTMLDivElement>).current;
        if (suggestionReadOut) {
            suggestionReadOut.innerHTML = this.currentLabel;
        }
    }

    removeLabel() {
        const suggestionReadOut = (this.props.ariaLiveRef as React.RefObject<HTMLDivElement>).current;
        if (suggestionReadOut) {
            suggestionReadOut.innerHTML = '';
        }
    }

    generateLabel(item: any) {
        if (item.username) {
            this.currentLabel = item.username;
            if ((item.first_name || item.last_name) && item.nickname) {
                this.currentLabel += ` ${item.first_name} ${item.last_name} ${item.nickname}`;
            } else if (item.nickname) {
                this.currentLabel += ` ${item.nickname}`;
            } else if (item.first_name || item.last_name) {
                this.currentLabel += ` ${item.first_name} ${item.last_name}`;
            }
        } else if (item.type === 'mention.channels') {
            this.currentLabel = item.channel.display_name;
        } else if (item.emoji) {
            this.currentLabel = item.name;
        }

        if (this.currentLabel) {
            this.currentLabel = this.currentLabel.toLowerCase();
        }
        this.announceLabel();
    }

    getContent = () => {
        return this.contentRef.current;
    };

    scrollToItem = (term: any) => {
        const content = this.getContent();
        if (!content) {
            return;
        }

        const visibleContentHeight = content.clientHeight;
        const actualContentHeight = content.scrollHeight;

        if (visibleContentHeight < actualContentHeight) {
            const contentTop = content.scrollTop;
            const contentTopPadding = this.getComputedCssProperty(content, 'paddingTop');
            const contentBottomPadding = this.getComputedCssProperty(content, 'paddingTop');

            const item = ReactDOM.findDOMNode(this.itemRefs.get(term));
            if (!item) {
                return;
            }

            if (item instanceof HTMLElement) {
                const itemTop = item.offsetTop - this.getComputedCssProperty(item, 'marginTop');
                const itemBottomMargin = this.getComputedCssProperty(item, 'marginBottom') + this.getComputedCssProperty(item, 'paddingBottom');
                const itemBottom = item.offsetTop + this.getComputedCssProperty(item, 'height') + itemBottomMargin;
                if (itemTop - contentTopPadding < contentTop) {
                    // the item is off the top of the visible space
                    content.scrollTop = itemTop - contentTopPadding;
                } else if (itemBottom + contentTopPadding + contentBottomPadding > contentTop + visibleContentHeight) {
                    // the item has gone off the bottom of the visible space
                    content.scrollTop = (itemBottom - visibleContentHeight) + contentTopPadding + contentBottomPadding;
                }
            }
        }
    };

    getComputedCssProperty(element: Element, property: string) {
        return parseInt(getComputedStyle(element)[property as keyof CSSStyleDeclaration] as string, 10);
    }

    getTransform() {
        if (!this.props.suggestionBoxAlgn) {
            return {};
        }

        const {lineHeight, pixelsToMoveX} = this.props.suggestionBoxAlgn;
        let pixelsToMoveY = this.props.suggestionBoxAlgn.pixelsToMoveY;

        if (this.props.position === 'bottom') {
            // Add the line height and 4 extra px so it looks less tight
            pixelsToMoveY += this.props.suggestionBoxAlgn.lineHeight + 4;
        }

        // If the suggestion box was invoked from the first line in the post box, stick to the top of the post box
        pixelsToMoveY = pixelsToMoveY > lineHeight ? pixelsToMoveY : 0;

        return {
            transform: `translate(${pixelsToMoveX}px, ${pixelsToMoveY}px)`,
        };
    }

    renderDivider(type: string) {
        const id = type ? 'suggestion.' + type : 'suggestion.default';
        return (
            <div
                key={type + '-divider'}
                className='suggestion-list__divider'
            >
                <span>
                    <FormattedMessage id={id}/>
                </span>
            </div>
        );
    }

    renderNoResults() {
        return (
            <div
                key='list-no-results'
                className='suggestion-list__no-results'
                ref={this.contentRef}
            >
                <FormattedMarkdownMessage
                    id='suggestion_list.no_matches'
                    defaultMessage='No items match __{value}__'
                    values={{
                        value: this.props.pretext || '""',
                    }}
                />
            </div>
        );
    }

    render() {
        const {renderDividers} = this.props;

        if (!this.props.open || this.props.cleared) {
            return null;
        }

        const clonedItems = cloneDeep(this.props.items);

        const items = [];
        if (clonedItems.length === 0) {
            if (!this.props.renderNoResults) {
                return null;
            }
            items.push(this.renderNoResults());
        }

        let prevItemType = null;
        for (let i = 0; i < this.props.items.length; i++) {
            const item = this.props.items[i];
            const term = this.props.terms[i];
            const isSelection = term === this.props.selection;

            // ReactComponent names need to be upper case when used in JSX
            const Component = this.props.components[i];
            if ((renderDividers!.includes('all') || renderDividers!.includes(item.type)) && prevItemType !== item.type) {
                items.push(this.renderDivider(item.type));
                prevItemType = item.type;
            }

            if (item.loading) {
                items.push(<LoadingSpinner key={item.type}/>);
                continue;
            }

            if (isSelection) {
                this.currentItem = item;
            }

            items.push(
                <Component
                    key={term}
                    ref={(ref: any) => this.itemRefs.set(term, ref)}
                    item={this.props.items[i]}
                    term={term}
                    matchedPretext={this.props.matchedPretext[i]}
                    isSelection={isSelection}
                    onClick={this.props.onCompleteWord}
                    onMouseMove={this.props.onItemHover}
                />,
            );
        }
        const mainClass = 'suggestion-list suggestion-list--' + this.props.position;
        const contentClass = 'suggestion-list__content suggestion-list__content--' + this.props.position;

        return (
            <div
                ref={this.wrapperRef}
                className={mainClass}
            >
                <div
                    id='suggestionList'
                    role='list'
                    ref={this.contentRef}
                    style={{
                        maxHeight: this.maxHeight,
                        ...this.getTransform(),
                    }}
                    className={contentClass}
                    onMouseDown={this.props.preventClose}
                >
                    {items}
                </div>
            </div>
        );
    }
}
