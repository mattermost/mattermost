// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import SuggestionBox from 'components/suggestion/suggestion_box';
import type {SuggestionBoxElement} from 'components/suggestion/suggestion_box/suggestion_box';
import SuggestionList from 'components/suggestion/suggestion_list';

import type ModalSuggestionList from './suggestion/modal_suggestion_list';
import type Provider from './suggestion/provider';

export type Option = {
    text: string;
    value: string;
};
export type Selected = Option | UserProfile | Channel;

type SuggestionBoxHandle = {
    getTextbox: () => SuggestionBoxElement | null;
    blur: () => void;
};

type Props = {
    id: string;
    providers: Provider[];
    value: string;
    onSelected?: (selected: Selected) => void;
    label?: React.ReactNode | string;
    labelClassName: string;
    inputClassName: string;
    helpText?: React.ReactNode | string;
    placeholder?: string;
    disabled?: boolean;
    toggleFocus?: ((focus: boolean) => void) | null;
    listComponent: typeof SuggestionList | typeof ModalSuggestionList;
    listPosition?: AutocompleteListPosition;
};

type State = {
    input: string;
    focused?: boolean;
    computedListPosition: SuggestionListPosition;
};

export default class AutocompleteSelector extends React.PureComponent<Props, State> {
    static defaultProps = {
        id: '',
        value: '',
        labelClassName: '',
        inputClassName: '',
        listComponent: SuggestionList,
    };

    suggestionRef?: SuggestionBoxHandle;

    constructor(props: Props) {
        super(props);

        this.state = {
            input: '',
            computedListPosition: 'top',
        };
    }

    onFocus = () => {
        const nextState: Pick<State, 'focused' | 'computedListPosition'> = {
            focused: true,
            computedListPosition: 'top',
        };

        if (this.props.listPosition === 'auto' && this.suggestionRef) {
            const input = this.suggestionRef.getTextbox();
            if (input) {
                nextState.computedListPosition = getSuggestionListPosition(input);
            }
        }

        this.setState(nextState);

        if (this.props.toggleFocus) {
            this.props.toggleFocus(true);
        }
    };

    onChange = (e: React.ChangeEvent<SuggestionBoxElement>) => {
        if (!e || !e.target) {
            return;
        }

        this.setState({input: e.target.value});
    };

    handleSelected = (selected: Selected) => {
        this.setState({input: ''});

        if (this.props.onSelected) {
            this.props.onSelected(selected);
        }

        requestAnimationFrame(() => {
            if (this.suggestionRef) {
                this.suggestionRef.blur();
            }
        });
    };

    setSuggestionRef = (ref: SuggestionBoxHandle) => {
        this.suggestionRef = ref;
    };

    onBlur = () => {
        this.setState({focused: false});

        if (this.props.toggleFocus) {
            this.props.toggleFocus(false);
        }
    };

    render() {
        const {
            providers,
            placeholder,
            label,
            labelClassName,
            helpText,
            inputClassName,
            value,
            disabled,
            listComponent,
            listPosition: listPositionProp,
        } = this.props;

        const listPosition = listPositionProp === 'auto' ?
            this.state.computedListPosition :
            listPositionProp;

        const {focused} = this.state;
        let {input} = this.state;

        if (!focused) {
            input = value;
        }

        let labelContent;
        if (label) {
            labelContent = (
                <label
                    className={'control-label ' + labelClassName}
                >
                    {label}
                </label>
            );
        }

        let helpTextContent;
        if (helpText) {
            helpTextContent = (
                <div className='help-text'>
                    {helpText}
                </div>
            );
        }

        return (
            <div
                data-testid='autoCompleteSelector'
                className='form-group'
            >
                {labelContent}
                <div className={inputClassName}>
                    <SuggestionBox
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        ref={this.setSuggestionRef}
                        placeholder={placeholder}
                        listComponent={listComponent}
                        className='form-control'
                        containerClass='select-suggestion-container'
                        value={input}
                        onChange={this.onChange}
                        onItemSelected={this.handleSelected}
                        onFocus={this.onFocus}
                        onBlur={this.onBlur}
                        providers={providers}
                        completeOnTab={true}
                        renderNoResults={true}
                        openOnFocus={true}
                        openWhenEmpty={true}
                        replaceAllInputOnSelect={true}
                        disabled={disabled}
                        listPosition={listPosition}
                    />
                    {helpTextContent}
                </div>
            </div>
        );
    }
}

type SuggestionListPosition = 'top' | 'bottom';

type AutocompleteListPosition = SuggestionListPosition | 'auto';

/** Open the suggestion list toward the side of the viewport with more room. */
export function getSuggestionListPosition(input: HTMLElement): SuggestionListPosition {
    if (typeof input?.getBoundingClientRect !== 'function') {
        return 'top';
    }

    const {top, bottom} = input.getBoundingClientRect();
    const spaceAbove = Math.max(0, top);
    const spaceBelow = Math.max(0, window.innerHeight - bottom);
    return spaceBelow > spaceAbove ? 'bottom' : 'top';
}
