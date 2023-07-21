// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {getOptionValue} from 'react-select/src/builtins';

import LoadingScreen from 'components/loading_screen';

import Constants from 'utils/constants';
import {cmdOrCtrlPressed} from 'utils/keyboard';

import {Value} from './multiselect';

export type Props<T extends Value> = {
    ariaLabelRenderer: getOptionValue<T>;
    loading?: boolean;
    onAdd: (value: T) => void;
    onPageChange?: (newPage: number, currentPage: number) => void;
    onSelect: (value: T | null) => void;
    optionRenderer: (
        option: T,
        isSelected: boolean,
        add: (value: T) => void,
        select: (value: T) => void
    ) => void;
    query?: string;
    selectedItemRef?: React.RefObject<HTMLDivElement>;
    options: T[];
    page: number;
    perPage: number;
    customNoOptionsMessage?: React.ReactNode;
}

type State = {
    selected: number;
}
const KeyCodes = Constants.KeyCodes;

export default class MultiSelectList<T extends Value> extends React.PureComponent<Props<T>, State> {
    public static defaultProps = {
        options: [],
        perPage: 50,
        onAction: () => null,
    };

    private toSelect = -1;
    private listRef = React.createRef<HTMLDivElement>();
    private selectedItemRef = React.createRef<HTMLDivElement>();

    public constructor(props: Props<T>) {
        super(props);

        this.state = {
            selected: -1,
        };
    }

    public componentDidMount() {
        document.addEventListener('keydown', this.handleArrowPress);
    }

    public componentWillUnmount() {
        document.removeEventListener('keydown', this.handleArrowPress);
    }

    public componentDidUpdate(_: Props<T>, prevState: State) {
        const options = this.props.options;
        if (options && options.length > 0 && this.state.selected >= 0) {
            this.props.onSelect(options[this.state.selected]);
        }

        if (prevState.selected === this.state.selected) {
            return;
        }

        const selectRef = this.selectedItemRef.current || this.props.selectedItemRef?.current;
        if (this.listRef.current && selectRef) {
            const elemTop = selectRef.getBoundingClientRect().top;
            const elemBottom = selectRef.getBoundingClientRect().bottom;
            const listTop = this.listRef.current.getBoundingClientRect().top;
            const listBottom = this.listRef.current.getBoundingClientRect().bottom;
            if (elemBottom > listBottom) {
                selectRef.scrollIntoView(false);
            } else if (elemTop < listTop) {
                selectRef.scrollIntoView(true);
            }
        }
    }

    // setSelected updates the selected index and is referenced
    // externally by the MultiSelect component.
    public setSelected = (selected: number) => {
        this.setState({selected});
    };

    private handleArrowPress = (e: KeyboardEvent) => {
        if (cmdOrCtrlPressed(e) && e.shiftKey) {
            return;
        }

        const options = this.props.options;
        if (options.length === 0) {
            return;
        }

        let selected;
        switch (e.key) {
        case KeyCodes.DOWN[0]:
            if (this.state.selected === -1) {
                selected = 0;
                break;
            }
            selected = Math.min(this.state.selected + 1, options.length - 1);
            break;
        case KeyCodes.UP[0]:
            if (this.state.selected === -1) {
                selected = 0;
                break;
            }
            selected = Math.max(this.state.selected - 1, 0);
            break;
        default:
            return;
        }

        e.preventDefault();
        this.setState({selected});
        this.props.onSelect(options[selected]);
    };

    private defaultOptionRenderer = (
        option: T,
        isSelected: boolean,
        add: (value: T) => void,
        select: (value: T) => void,
    ) => {
        let rowSelected = '';
        if (isSelected) {
            rowSelected = 'more-modal__row--selected';
        }

        return (
            <div
                ref={isSelected ? this.selectedItemRef : option.value}
                className={rowSelected}
                key={'multiselectoption' + option.value}
                onClick={() => add(option)}
                onMouseEnter={() => select(option)}
            >
                {option.label}
            </div>
        );
    };

    private select = (option: T) => {
        const i = this.props.options.indexOf(option);
        if (i !== -1) {
            if (this.state.selected !== i) {
                this.setSelected(i);
            }
        }
    };

    public render() {
        const {options, customNoOptionsMessage} = this.props;
        let renderOutput;

        if (this.props.loading) {
            renderOutput = (
                <div aria-hidden={true}>
                    <LoadingScreen
                        position='absolute'
                        key='loading'
                    />
                </div>
            );
        } else if (options == null || options.length === 0) {
            if (customNoOptionsMessage) {
                renderOutput = customNoOptionsMessage;
            } else {
                renderOutput = (
                    <div
                        key='no-users-found'
                        className='no-channel-message'
                        tabIndex={0}
                    >
                        <p className='primary-message'>
                            <FormattedMessage
                                id='multiselect.list.notFound'
                                defaultMessage='No results found matching <b>{searchQuery}</b>'
                                values={{
                                    searchQuery: this.props.query,
                                    b: (value: string) => <b>{value}</b>,
                                }}
                            />
                        </p>
                    </div>
                );
            }
        } else {
            let renderer: Props<T>['optionRenderer'];
            if (this.props.optionRenderer) {
                renderer = this.props.optionRenderer;
            } else {
                renderer = this.defaultOptionRenderer;
            }

            const optionControls = options.map((o, i) => renderer(o, this.state.selected === i, this.props.onAdd, this.select));

            const selectedOption = options[this.state.selected];
            const ariaLabel = this.props.ariaLabelRenderer(selectedOption);

            renderOutput = (
                <div className='more-modal__list'>
                    <div
                        className='sr-only'
                        aria-live='polite'
                        aria-atomic='true'
                    >
                        {ariaLabel}
                    </div>
                    <div
                        ref={this.listRef}
                        id='multiSelectList'
                        className='more-modal__options'
                        role='presentation'
                        aria-hidden={true}
                    >
                        {optionControls}
                    </div>
                </div>
            );
        }

        return (
            <div
                className='multi-select__wrapper'
                aria-live='polite'
            >
                {renderOutput}
            </div>
        );
    }
}
