// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch} from 'react-redux';
import type {OnChangeValue} from 'react-select';
import ReactSelect from 'react-select';
import AsyncSelect from 'react-select/async';

import type {UserAutocomplete} from '@mattermost/types/autocomplete';
import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {MmSelectInputBlock, MmStaticSelectOption} from '@mattermost/types/mm_blocks';
import type {UserProfile} from '@mattermost/types/users';

import {autocompleteChannels} from 'actions/channel_actions';
import {autocompleteUsers} from 'actions/user_actions';

import AutocompleteSelector from 'components/autocomplete_selector';
import type {Option, Selected} from 'components/autocomplete_selector';
import Markdown from 'components/markdown';
import PostContext from 'components/post_view/post_context';
import GenericChannelProvider from 'components/suggestion/generic_channel_provider';
import GenericUserProvider from 'components/suggestion/generic_user_provider';
import MenuActionProvider from 'components/suggestion/menu_action_provider';
import ModalSuggestionList from 'components/suggestion/modal_suggestion_list';
import SuggestionList from 'components/suggestion/suggestion_list';
import RadioSetting from 'components/widgets/settings/radio_setting';
import Setting from 'components/widgets/settings/setting';

import {ExpandedChoiceList} from './expanded_choice_list';
import {FormFieldLabel} from './form_field_label';
import {
    displayTextForValue,
    flattenSelectOptions,
    initialMultiValue,
    initialSingleValue,
    normalizeMultiValue,
    normalizeSingleValue,
    reactSelectStyles,
    toReactSelectOption,
    toReactSelectOptions,
} from './utils';
import type {MmBlocksSelectProvider, ReactSelectOption} from './utils';

import {MmBlocksInModalContext, MmBlocksInteractionsDisabledContext, useMmBlocksHandlers} from '../context';
import {MmBlocksFieldError, useMmBlocksForm} from '../form';
import {mmBlocksFieldDomId} from '../utils/field_dom_id';

type SelectInputElementProps = {
    element: MmSelectInputBlock;
    postId: string;
};

export const SelectInputElement = ({element, postId}: SelectInputElementProps) => {
    const dispatch = useDispatch();
    const interactionsDisabled = useContext(MmBlocksInteractionsDisabledContext);
    const inModal = useContext(MmBlocksInModalContext);
    const {onAction, onLookup} = useMmBlocksHandlers();
    const {values, setValue, setDefaultValue} = useMmBlocksForm();
    const fieldDomId = mmBlocksFieldDomId(postId, element.name);
    const disabled = interactionsDisabled || element.disabled === true;
    const multiselect = element.multiselect === true;
    const style = element.style === 'expanded' ? 'expanded' : 'compact';
    const isUserSource = element.data_source === 'users';
    const isChannelSource = element.data_source === 'channels';
    const isLookupSource = element.data_source === 'dynamic' && Boolean(element.data_source_action) && Boolean(onLookup);
    const isDynamicSource = isUserSource || isChannelSource;

    const flatOptions = useMemo(() => flattenSelectOptions(element), [element]);
    const reactSelectOptions = useMemo(() => toReactSelectOptions(element), [element]);

    const initialOption = element.initial_option;
    const initialOptionsKey = element.initial_options?.join('\0') ?? '';

    useEffect(() => {
        if (multiselect) {
            let initial: string[];
            if (initialOptionsKey) {
                initial = initialOptionsKey.split('\0');
            } else if (initialOption) {
                initial = [initialOption];
            } else {
                initial = [];
            }
            setDefaultValue(element.name, initial);
        } else {
            setDefaultValue(element.name, initialOption ?? '');
        }
    }, [element.name, initialOption, initialOptionsKey, multiselect, setDefaultValue]);

    const rawValue = values[element.name];
    const singleValue = normalizeSingleValue(rawValue, initialSingleValue(element));
    const multiValue = normalizeMultiValue(rawValue, initialMultiValue(element));

    const [autocompleteDisplay, setAutocompleteDisplay] = useState(() => {
        if (isDynamicSource) {
            // Seed from stored form value so remounts keep the selection visible.
            return singleValue;
        }
        return displayTextForValue(flatOptions, initialSingleValue(element));
    });

    // Keep dynamic display in sync when the stored value is cleared or first becomes available.
    useEffect(() => {
        if (!isDynamicSource) {
            return;
        }
        if (!singleValue) {
            setAutocompleteDisplay('');
            return;
        }
        setAutocompleteDisplay((prev) => prev || singleValue);
    }, [isDynamicSource, singleValue]);

    // Multiselect users/channels need AsyncSelect (AutocompleteSelector is single-value only).
    const useAsyncUserChannelSelect = isDynamicSource && multiselect;

    // Async options are not in `flatOptions`; keep the selected {label, value}
    // so AsyncSelect can show the label after selection (form state only stores values).
    const [lookupSelection, setLookupSelection] = useState<OnChangeValue<ReactSelectOption, boolean>>(() => {
        if (!isLookupSource && !useAsyncUserChannelSelect) {
            return null;
        }
        if (multiselect) {
            const initial = initialMultiValue(element);
            return initial.length ? initial.map((v) => ({label: v, value: v})) : null;
        }
        const initial = initialSingleValue(element);
        return initial ? {label: initial, value: initial} : null;
    });

    // Defer empty-query option load until the menu opens (react-select only auto-fetches
    // defaultOptions=true on mount, so we load explicitly and pass the result as an array).
    const [asyncDefaultOptions, setAsyncDefaultOptions] = useState<ReactSelectOption[] | false>(false);
    const [loadingDefaultOptions, setLoadingDefaultOptions] = useState(false);
    const loadingDefaultOptionsRef = useRef(false);

    const commitValue = useCallback((name: string, next: string | string[]) => {
        setValue(name, next);

        if (!element.onChange || interactionsDisabled) {
            return;
        }

        const formValues = {...values, [name]: next};
        onAction(element.onChange, undefined, undefined, undefined, formValues);
    }, [element.onChange, interactionsDisabled, onAction, setValue, values]);

    const label = useMemo(
        () => {
            if (!element.label.trim()) {
                return null;
            }
            return (
                <FormFieldLabel
                    label={element.label}
                    optional={element.optional}
                />
            );
        },
        [element.label, element.optional],
    );
    const helpText = element.help_text ? <Markdown message={element.help_text}/> : undefined;

    const wrapAutocompleteUsers = useCallback(
        (username: string) => dispatch(autocompleteUsers(username)) as Promise<UserAutocomplete>,
        [dispatch],
    );

    const wrapAutocompleteChannels = useCallback(
        (term: string, success: (channels: Channel[]) => void, error?: (err: ServerError) => void) => {
            return dispatch(autocompleteChannels(term, success, error));
        },
        [dispatch],
    );

    const providers = useMemo((): MmBlocksSelectProvider[] => {
        if (isUserSource) {
            return [new GenericUserProvider(wrapAutocompleteUsers)];
        }
        if (isChannelSource) {
            return [new GenericChannelProvider(wrapAutocompleteChannels)];
        }
        if (flatOptions.length > 0 && !multiselect && style === 'compact' && !element.option_groups?.length) {
            return [new MenuActionProvider(flatOptions)];
        }
        return [];
    }, [
        element.option_groups,
        flatOptions,
        isChannelSource,
        isUserSource,
        multiselect,
        style,
        wrapAutocompleteChannels,
        wrapAutocompleteUsers,
    ]);

    const handleAutocompleteSelected = useCallback((selected: Selected) => {
        if (disabled || !selected) {
            return;
        }

        let selectedOption = '';
        let text = '';
        if (isUserSource) {
            const user = selected as UserProfile;
            text = user.username;
            selectedOption = user.id;
        } else if (isChannelSource) {
            const channel = selected as Channel;
            text = channel.display_name;
            selectedOption = channel.id;
        } else {
            const option = selected as Option;
            text = option.text;
            selectedOption = option.value;
        }

        setAutocompleteDisplay(text);
        commitValue(element.name, selectedOption);
    }, [commitValue, disabled, element.name, isChannelSource, isUserSource]);

    const handleReactSelectChange = useCallback((selected: OnChangeValue<ReactSelectOption, boolean>) => {
        if (disabled) {
            return;
        }
        if (multiselect) {
            const next = (selected as ReactSelectOption[] | null)?.map((o) => o.value) ?? [];
            commitValue(element.name, next);
            return;
        }
        const next = (selected as ReactSelectOption | null)?.value ?? '';
        commitValue(element.name, next);
    }, [commitValue, disabled, element.name, multiselect]);

    const handleLookupSelectChange = useCallback((selected: OnChangeValue<ReactSelectOption, boolean>) => {
        if (disabled) {
            return;
        }
        setLookupSelection(selected);
        handleReactSelectChange(selected);
    }, [disabled, handleReactSelectChange]);

    const handleExpandedChange = useCallback((_name: string, value: string | string[]) => {
        if (disabled) {
            return;
        }
        commitValue(element.name, value);
    }, [commitValue, disabled, element.name]);

    const loadLookupOptions = useCallback(async (inputValue: string): Promise<ReactSelectOption[]> => {
        if (!onLookup || !element.data_source_action || interactionsDisabled) {
            return [];
        }
        const items = await onLookup(element.data_source_action, inputValue, values);
        return items.map((item) => ({label: item.text, value: item.value}));
    }, [element.data_source_action, interactionsDisabled, onLookup, values]);

    const loadUserChannelOptions = useCallback(async (inputValue: string): Promise<ReactSelectOption[]> => {
        if (interactionsDisabled) {
            return [];
        }
        if (isUserSource) {
            const result = await wrapAutocompleteUsers(inputValue.toLowerCase());
            return (result?.users ?? []).
                filter((user) => !user.is_bot).
                map((user) => ({label: user.username, value: user.id}));
        }
        if (isChannelSource) {
            const channels = await new Promise<Channel[]>((resolve) => {
                wrapAutocompleteChannels(inputValue.toLowerCase(), resolve, () => resolve([]));
            });
            return channels.map((channel) => ({label: channel.display_name, value: channel.id}));
        }
        return [];
    }, [interactionsDisabled, isChannelSource, isUserSource, wrapAutocompleteChannels, wrapAutocompleteUsers]);

    const handleAsyncMenuOpen = useCallback(() => {
        if (asyncDefaultOptions !== false || loadingDefaultOptionsRef.current) {
            return;
        }
        loadingDefaultOptionsRef.current = true;
        setLoadingDefaultOptions(true);
        const loader = isLookupSource ? loadLookupOptions : loadUserChannelOptions;
        loader('').
            then((options) => {
                setAsyncDefaultOptions(options);
            }).
            catch(() => {
                loadingDefaultOptionsRef.current = false;
            }).
            finally(() => {
                setLoadingDefaultOptions(false);
            });
    }, [asyncDefaultOptions, isLookupSource, loadLookupOptions, loadUserChannelOptions]);

    if (!element.name) {
        return null;
    }

    const hasStaticOptions = flatOptions.length > 0;
    if (!isDynamicSource && !isLookupSource && !hasStaticOptions) {
        return null;
    }

    // Expanded: radio (single) or checkbox list (multi). Prefer RadioSetting when it fits.
    if (style === 'expanded' && !isDynamicSource && !isLookupSource) {
        if (!multiselect && !element.option_groups?.length) {
            return (
                <div className='mm-blocks-select-input'>
                    <fieldset disabled={disabled}>
                        <RadioSetting
                            id={fieldDomId}
                            label={label}
                            helpText={helpText}
                            options={flatOptions}
                            value={singleValue}
                            onChange={handleExpandedChange}
                        />
                    </fieldset>
                    <MmBlocksFieldError name={element.name}/>
                </div>
            );
        }

        return (
            <div className='mm-blocks-select-input'>
                <ExpandedChoiceList
                    id={fieldDomId}
                    label={label}
                    helpText={helpText}
                    options={flatOptions}
                    optionGroups={element.option_groups}
                    multiselect={multiselect}
                    value={multiselect ? multiValue : singleValue}
                    disabled={disabled}
                    onChange={handleExpandedChange}
                />
                <MmBlocksFieldError name={element.name}/>
            </div>
        );
    }

    // Single-select users/channels and flat static: AutocompleteSelector (attachments-style).
    // Multiselect users/channels use AsyncSelect below.
    const useAutocomplete = (isDynamicSource && !multiselect) || (
        !multiselect &&
        !element.option_groups?.length &&
        hasStaticOptions &&
        providers.length > 0
    );

    if (isLookupSource || useAsyncUserChannelSelect) {
        let selectedReactValue: OnChangeValue<ReactSelectOption, boolean>;
        if (lookupSelection != null) {
            selectedReactValue = lookupSelection;
        } else if (multiselect) {
            selectedReactValue = multiValue.map((v) => ({label: v, value: v}));
        } else if (singleValue) {
            selectedReactValue = {label: singleValue, value: singleValue};
        } else {
            selectedReactValue = null;
        }

        return (
            <div className='mm-blocks-select-input'>
                <Setting
                    label={label}
                    helpText={helpText}
                    inputId={fieldDomId}
                    footer={<MmBlocksFieldError name={element.name}/>}
                >
                    <div className='react-select'>
                        <AsyncSelect
                            inputId={fieldDomId}
                            isMulti={multiselect}
                            placeholder={element.placeholder ?? ''}
                            value={selectedReactValue}
                            onChange={handleLookupSelectChange}
                            isDisabled={disabled}
                            isClearable={!multiselect}
                            isLoading={loadingDefaultOptions}
                            cacheOptions={true}
                            defaultOptions={asyncDefaultOptions}
                            loadOptions={isLookupSource ? loadLookupOptions : loadUserChannelOptions}
                            onMenuOpen={handleAsyncMenuOpen}
                            classNamePrefix='react-select-auto react-select'
                            menuPortalTarget={typeof document === 'undefined' ? null : document.body}
                            styles={reactSelectStyles}
                            openMenuOnFocus={false}
                        />
                    </div>
                </Setting>
            </div>
        );
    }

    if (useAutocomplete) {
        let displayValue = autocompleteDisplay;
        if (!isDynamicSource) {
            displayValue = displayTextForValue(flatOptions, singleValue) || autocompleteDisplay;
        }

        return (
            <div className='mm-blocks-select-input'>
                <Setting
                    label={label}
                    helpText={helpText}
                    inputId={fieldDomId}
                    footer={<MmBlocksFieldError name={element.name}/>}
                >
                    <PostContext.Consumer>
                        {({handlePopupOpened}) => (
                            <AutocompleteSelector
                                id={fieldDomId}
                                providers={providers}
                                onSelected={handleAutocompleteSelected}
                                placeholder={element.placeholder}
                                inputClassName='mm-blocks-select'
                                value={displayValue}
                                toggleFocus={handlePopupOpened}
                                listComponent={inModal ? ModalSuggestionList : SuggestionList}
                                listPosition='auto'
                                disabled={disabled}
                                deferLoad={true}
                            />
                        )}
                    </PostContext.Consumer>
                </Setting>
            </div>
        );
    }

    // Compact multi / option_groups: react-select like Apps Form / Interactive Dialogs.
    const selectedOption = flatOptions.find((o) => o.value === singleValue);
    let selectedReactValue: OnChangeValue<ReactSelectOption, boolean>;
    if (multiselect) {
        selectedReactValue = multiValue.
            map((v) => flatOptions.find((o) => o.value === v)).
            filter((o): o is MmStaticSelectOption => Boolean(o)).
            map(toReactSelectOption);
    } else if (selectedOption) {
        selectedReactValue = toReactSelectOption(selectedOption);
    } else {
        selectedReactValue = null;
    }

    return (
        <div className='mm-blocks-select-input'>
            <Setting
                label={label}
                helpText={helpText}
                inputId={fieldDomId}
                footer={<MmBlocksFieldError name={element.name}/>}
            >
                <div className='react-select'>
                    <ReactSelect
                        inputId={fieldDomId}
                        options={reactSelectOptions}
                        isMulti={multiselect}
                        placeholder={element.placeholder ?? ''}
                        value={selectedReactValue}
                        onChange={handleReactSelectChange}
                        isDisabled={disabled}
                        isClearable={!multiselect}
                        classNamePrefix='react-select-auto react-select'
                        menuPortalTarget={typeof document === 'undefined' ? null : document.body}
                        styles={reactSelectStyles}
                        openMenuOnFocus={false}
                    />
                </div>
            </Setting>
        </div>
    );
};
