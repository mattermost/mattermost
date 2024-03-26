// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import SuggestionBox from 'components/suggestion/suggestion_box';
import SuggestionList from 'components/suggestion/suggestion_list';

import type ModalSuggestionList from './suggestion/modal_suggestion_list';
import type Provider from './suggestion/provider';

export type Option = {
    text: string;
    value: string;
};
export type Selected = Option | UserProfile | Channel

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
    footer?: Node;
    disabled?: boolean;
    toggleFocus?: ((focus: boolean) => void) | null;
    listComponent: typeof SuggestionList | typeof ModalSuggestionList;
    listPosition: string;
};

type State = {
    input: string;
    focused?: boolean;
};

type ChangeEvent = {
    target: HTMLInputElement;
}

export default class AutocompleteSelector extends React.PureComponent<Props, State> {
    static defaultProps = {
        id: '',
        value: '',
        labelClassName: '',
        inputClassName: '',
        listComponent: SuggestionList,
        listPosition: 'top',
    };

    suggestionRef?: HTMLElement;

    constructor(props: Props) {
        super(props);

        this.state = {
            input: '',
        };
    }

    onChange = (e: ChangeEvent) => {
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

    setSuggestionRef = (ref: HTMLElement) => {
        this.suggestionRef = ref;
    };

    onFocus = () => {
        this.setState({focused: true});

        if (this.props.toggleFocus) {
            this.props.toggleFocus(true);
        }
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
            footer,
            label,
            labelClassName,
            helpText,
            inputClassName,
            value,
            disabled,
            listComponent,
            listPosition,
        } = this.props;

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
                    {footer}
                </div>
            </div>
        );
    }
}
