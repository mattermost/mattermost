// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ComponentProps, RefObject} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessages} from 'react-intl';
import {components} from 'react-select';
import type {InputActionMeta, SelectInstance, MultiValue, GroupBase, MultiValueRemoveProps} from 'react-select';
import AsyncSelect from 'react-select/async';
import type {SelectComponents} from 'react-select/dist/declarations/src/components';

import type {Channel} from '@mattermost/types/channels';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import CloseCircleSolidIcon from 'components/widgets/icons/close_circle_solid_icon';
import PublicChannelIcon from 'components/widgets/icons/globe_icon';
import PrivateChannelIcon from 'components/widgets/icons/lock_icon';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {Constants} from 'utils/constants';

import './channels_input.scss';

type Props<T extends Channel> = {
    placeholder: React.ReactNode;
    autoFocus?: boolean;
    ariaLabel: string;
    channelsLoader: (value: string, callback?: (channels: T[]) => void) => Promise<T[]>;
    onChange: (channels: T[]) => void;
    value: T[];
    onInputChange: (change: string) => void;
    inputValue: string;
    loadingMessage?: MessageDescriptor;
    noOptionsMessage?: MessageDescriptor;
    formatOptionLabel?: ComponentProps<typeof AsyncSelect<T>>['formatOptionLabel'];
}

type State<T> = {
    options: T[];
};

const messages = defineMessages({
    loading: {
        id: 'widgets.channels_input.loading',
        defaultMessage: 'Loading',
    },
    noOptions: {
        id: 'widgets.channels_input.empty',
        defaultMessage: 'No channels found',
    },
});

export default class ChannelsInput<T extends Channel> extends React.PureComponent<Props<T>, State<T>> {
    static defaultProps = {
        loadingMessage: messages.loading,
        noOptionsMessage: messages.noOptions,
    };
    private selectRef: RefObject<SelectInstance<T, true>>;

    constructor(props: Props<T>) {
        super(props);
        this.selectRef = React.createRef();
        this.state = {
            options: [],
        };
    }

    getOptionValue = (channel: T) => channel.id;

    handleInputChange = (inputValue: string, action: InputActionMeta) => {
        if (action.action === 'input-blur' && inputValue !== '') {
            for (const option of this.state.options) {
                if (this.props.inputValue === option.name) {
                    this.onChange([...this.props.value, option]);
                    this.props.onInputChange('');
                    return;
                }
            }
        }
        if (action.action !== 'input-blur' && action.action !== 'menu-close') {
            this.props.onInputChange(inputValue);
        }
    };

    optionsLoader = (inputValue: string, callback: (options: T[]) => void) => {
        const customCallback = (options: T[]) => {
            this.setState({options});
            callback(options);
        };
        const result = this.props.channelsLoader(inputValue, customCallback);
        if (result && result.then) {
            result.then(customCallback);
        }
    };

    loadingMessage = () => {
        const text = (
            <FormattedMessage
                {...this.props.loadingMessage}
            />
        );

        return (<LoadingSpinner text={text}/>);
    };

    NoOptionsMessage = (props: Record<string, any>) => {
        const inputValue = props.selectProps.inputValue;
        if (!inputValue) {
            return null;
        }
        const Msg: any = components.NoOptionsMessage;
        return (
            <div className='channels-input__option channels-input__option--no-matches'>
                <Msg {...props}>
                    <FormattedMarkdownMessage
                        {...this.props.noOptionsMessage}
                        values={{text: inputValue}}
                    />
                </Msg>
            </div>
        );
    };

    formatOptionLabel = (channel: T) => {
        let icon = <PublicChannelIcon className='public-channel-icon'/>;
        if (channel.type === Constants.PRIVATE_CHANNEL) {
            icon = <PrivateChannelIcon className='private-channel-icon'/>;
        }
        return (
            <>
                {icon}
                {channel.display_name}
                <span className='channel-name'>{channel.name}</span>
            </>
        );
    };

    onChange = (value: MultiValue<T>) => {
        if (this.props.onChange) {
            // Copy value to avoid callers from having to deal with it being readonly
            this.props.onChange([...value]);
        }
    };

    MultiValueRemove = (props: MultiValueRemoveProps<T, boolean, GroupBase<T>>) => {
        const {innerProps, children} = props;

        return (<div {...innerProps}>
            {children || <CloseCircleSolidIcon/>}
        </div>);
    };

    components: Partial<SelectComponents<T, true, GroupBase<T>>> = {
        NoOptionsMessage: this.NoOptionsMessage,
        MultiValueRemove: this.MultiValueRemove,
        IndicatorsContainer: () => null,
    };

    onFocus = () => {
        this.selectRef.current?.onInputChange(this.props.inputValue, {prevInputValue: this.props.inputValue, action: 'set-value'});
    };

    render() {
        return (
            <AsyncSelect
                ref={this.selectRef}
                onChange={this.onChange}

                loadOptions={this.optionsLoader}
                isMulti={true}
                isClearable={false}
                className={classNames('ChannelsInput', {empty: this.props.inputValue === ''})}
                classNamePrefix='channels-input'
                placeholder={this.props.placeholder}
                components={this.components}
                getOptionValue={this.getOptionValue}
                formatOptionLabel={this.props.formatOptionLabel ?? this.formatOptionLabel}
                loadingMessage={this.loadingMessage}
                defaultOptions={false}
                defaultMenuIsOpen={false}
                openMenuOnClick={false}
                onInputChange={this.handleInputChange}
                inputValue={this.props.inputValue}
                openMenuOnFocus={true}
                onFocus={this.onFocus}
                tabSelectsValue={true}
                value={this.props.value}
                aria-label={this.props.ariaLabel}
                autoFocus={this.props.autoFocus}
            />
        );
    }
}
