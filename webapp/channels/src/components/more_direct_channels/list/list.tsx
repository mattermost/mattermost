// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {openModal} from 'actions/views/modals';

import MultiSelect from 'components/multiselect/multiselect';
import NewChannelModal from 'components/new_channel_modal/new_channel_modal';

import Constants, {ModalIdentifiers} from 'utils/constants';

import ListItem from '../list_item';
import {optionValue} from '../types';
import type {Option, OptionValue} from '../types';

const MAX_SELECTABLE_VALUES = Constants.MAX_USERS_IN_GM - 1;
export const USERS_PER_PAGE = 50;

type Props = {
    addValue: (value: OptionValue) => void;
    currentUserId: string;
    handleDelete: (values: OptionValue[]) => void;
    handlePageChange: (page: number, prevPage: number) => void;
    handleSubmit: (values?: OptionValue[]) => void;
    handleHide: () => void;
    isExistingChannel: boolean;
    loading: boolean;
    options: Option[];
    saving: boolean;
    search: (term: string) => void;
    selectedItemRef: React.RefObject<HTMLDivElement>;
    totalCount: number;
    users: UserProfile[];

    /**
     * An array of values that have been selected by the user in the multiselect.
     */
    values: OptionValue[];
}

const List = React.forwardRef((props: Props, ref?: React.Ref<MultiSelect<OptionValue>>) => {
    const renderOptionValue = useCallback((
        option: OptionValue,
        isSelected: boolean,
        add: (value: OptionValue) => void,
        select: (value: OptionValue) => void,
    ) => {
        return (
            <ListItem
                ref={isSelected ? props.selectedItemRef : undefined}
                key={'more_direct_channels_list_' + option.value}
                option={option}
                isSelected={isSelected}
                add={add}
                select={select}
            />
        );
    }, [props.selectedItemRef]);

    const dispatch = useDispatch();

    const handleSubmitImmediatelyOn = useCallback((value: OptionValue) => {
        return value.id === props.currentUserId || Boolean(value.delete_at);
    }, [props.currentUserId]);

    const handleCreateChannel = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        props.handleHide();
        dispatch(openModal({modalId: ModalIdentifiers.NEW_CHANNEL_MODAL, dialogType: NewChannelModal}));
    };

    const intl = useIntl();

    let note;
    if (props.isExistingChannel) {
        if (props.values.length >= MAX_SELECTABLE_VALUES) {
            note = (
                <FormattedMessage
                    id='more_direct_channels.new_convo_note.full'
                    defaultMessage={'You\'ve reached the maximum number of people for this conversation. Consider creating a private channel instead.'}
                />
            );
        } else {
            note = (
                <FormattedMessage
                    id='more_direct_channels.new_convo_note'
                    defaultMessage={'This will start a new conversation. If you\'re adding a lot of people, consider creating a private channel instead.'}
                />
            );
        }
    }

    let remainingText;
    if (MAX_SELECTABLE_VALUES > props.values.length) {
        remainingText = (
            <FormattedMessage
                id={'multiselect.numPeopleRemaining'}
                defaultMessage={'Use ↑↓ to browse, ↵ to select. You can add {num, number} more {num, plural, one {person} other {people}}. '}
                values={{
                    num: MAX_SELECTABLE_VALUES - props.values.length,
                }}
            />
        );
    } else {
        remainingText = (
            <FormattedMessage
                id={'multiselect.maxPeople'}
                defaultMessage={'Use ↑↓ to browse, ↵ to select. You can\'t add more than {num} people. Please <a>create a channel</a> to include more people.'}
                values={{
                    num: MAX_SELECTABLE_VALUES,
                    a: (chunks: React.ReactNode) => {
                        return (
                            <a
                                href='#'
                                onClick={(e) => handleCreateChannel(e)}
                            >{chunks}</a>
                        );
                    },
                }}
            />
        );
    }

    const options = useMemo(() => {
        return props.options.map(optionValue);
    }, [props.options]);

    return (
        <MultiSelect<OptionValue>
            ref={ref}
            options={options}
            optionRenderer={renderOptionValue}
            intl={intl}
            selectedItemRef={props.selectedItemRef}
            values={props.values}
            valueRenderer={renderValue}
            ariaLabelRenderer={renderAriaLabel}
            perPage={USERS_PER_PAGE}
            handlePageChange={props.handlePageChange}
            handleInput={props.search}
            handleDelete={props.handleDelete}
            handleAdd={props.addValue}
            handleSubmit={props.handleSubmit}
            noteText={note}
            maxValues={MAX_SELECTABLE_VALUES}
            numRemainingText={remainingText}
            buttonSubmitText={
                <FormattedMessage
                    id='multiselect.go'
                    defaultMessage='Go'
                />
            }
            buttonSubmitLoadingText={
                <FormattedMessage
                    id='multiselect.loading'
                    defaultMessage='Loading...'
                />
            }
            submitImmediatelyOn={handleSubmitImmediatelyOn}
            saving={props.saving}
            loading={props.loading}
            users={props.users}
            totalCount={props.totalCount}
            placeholderText={intl.formatMessage({id: 'multiselect.placeholder', defaultMessage: 'Search and add members'})}
        />
    );
});

export default List;

function renderValue(props: {data: OptionValue}) {
    return (props.data as UserProfile).username;
}

function renderAriaLabel(option: OptionValue) {
    return (option as UserProfile)?.username ?? '';
}
