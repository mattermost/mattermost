// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';
import classNames from 'classnames';
import React, {RefObject} from 'react';
import {FormattedMessage} from 'react-intl';
import {components, ValueType, ActionMeta, InputActionMeta} from 'react-select';
import AsyncSelect, {Async} from 'react-select/async';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import CloseCircleSolidIcon from 'components/widgets/icons/close_circle_solid_icon';
import PublicChannelIcon from 'components/widgets/icons/globe_icon';
import PrivateChannelIcon from 'components/widgets/icons/lock_icon';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {Constants} from 'utils/constants';
import {t} from 'utils/i18n';

import './channels_input.scss';

type Props = {
    placeholder: React.ReactNode;
    ariaLabel: string;
    channelsLoader: (value: string, callback?: (channels: Channel[]) => void) => Promise<Channel[]>;
    onChange: (channels: Channel[]) => void;
    value: Channel[];
    onInputChange: (change: string) => void;
    inputValue: string;
    loadingMessageId?: string;
    loadingMessageDefault?: string;
    noOptionsMessageId?: string;
    noOptionsMessageDefault?: string;
}

type State = {
    options: Channel[];
};

export default class ChannelsInput extends React.PureComponent<Props, State> {
    static defaultProps = {
        loadingMessageId: t('widgets.channels_input.loading'),
        loadingMessageDefault: 'Loading',
        noOptionsMessageId: t('widgets.channels_input.empty'),
        noOptionsMessageDefault: 'No channels found',
    };
    private selectRef: RefObject<Async<Channel> & {handleInputChange: (newValue: string, actionMeta: InputActionMeta | {action: 'custom'}) => string}>;

    constructor(props: Props) {
        super(props);
        this.selectRef = React.createRef();
        this.state = {
            options: [],
        };
    }

    getOptionValue = (channel: Channel) => channel.id;

    handleInputChange = (inputValue: string, action: InputActionMeta) => {
        if (action.action === 'input-blur' && inputValue !== '') {
            for (const option of this.state.options) {
                if (this.props.inputValue === option.name) {
                    this.onChange([...this.props.value, option], {} as ActionMeta<Channel>);
                    this.props.onInputChange('');
                    return;
                }
            }
        }
        if (action.action !== 'input-blur' && action.action !== 'menu-close') {
            this.props.onInputChange(inputValue);
        }
    };

    optionsLoader = (_input: string, callback: (options: Channel[]) => void) => {
        const customCallback = (options: Channel[]) => {
            this.setState({options});
            callback(options);
        };
        const result = this.props.channelsLoader(this.props.inputValue, customCallback);
        if (result && result.then) {
            result.then(customCallback);
        }
    };

    loadingMessage = () => {
        const text = (
            <FormattedMessage
                id={this.props.loadingMessageId}
                defaultMessage={this.props.loadingMessageDefault}
            />
        );

        // faking types due to longstanding mismatches in react-select & @types/react-select
        return (<LoadingSpinner text={text}/> as unknown as string);
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
                        id={this.props.noOptionsMessageId}
                        defaultMessage={this.props.noOptionsMessageDefault}
                        values={{text: inputValue}}
                    />
                </Msg>
            </div>
        );
    };

    formatOptionLabel = (channel: Channel) => {
        let icon = <PublicChannelIcon className='public-channel-icon'/>;
        if (channel.type === Constants.PRIVATE_CHANNEL) {
            icon = <PrivateChannelIcon className='private-channel-icon'/>;
        }
        return (
            <React.Fragment>
                {icon}
                {channel.display_name}
                <span className='channel-name'>{channel.name}</span>
            </React.Fragment>
        );
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onChange = (value: Channel[], _meta: ActionMeta<Channel>) => {
        if (this.props.onChange) {
            this.props.onChange(value);
        }
    };

    MultiValueRemove = ({children, innerProps}: {children: React.ReactNode | React.ReactNodeArray; innerProps: Record<string, any>}) => (
        <div {...innerProps}>
            {children || <CloseCircleSolidIcon/>}
        </div>
    );

    components = {
        NoOptionsMessage: this.NoOptionsMessage,
        MultiValueRemove: this.MultiValueRemove,
        IndicatorsContainer: () => null,
    };

    onFocus = () => {
        this.selectRef.current?.handleInputChange(this.props.inputValue, {action: 'custom'});
    };

    render() {
        return (
            <AsyncSelect
                ref={this.selectRef}
                onChange={this.onChange as (value: ValueType<Channel>, _meta: ActionMeta<Channel>) => void}

                loadOptions={this.optionsLoader}
                isMulti={true}
                isClearable={false}
                className={classNames('ChannelsInput', {empty: this.props.inputValue === ''})}
                classNamePrefix='channels-input'
                placeholder={this.props.placeholder}
                components={this.components}
                getOptionValue={this.getOptionValue}
                formatOptionLabel={this.formatOptionLabel}
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
            />
        );
    }
}
