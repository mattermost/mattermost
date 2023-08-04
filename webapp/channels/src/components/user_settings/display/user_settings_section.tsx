// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';

import {FormattedMessage} from 'react-intl';
import {PrimitiveType, FormatXMLElementFn} from 'intl-messageformat';

import SettingItem from 'components/setting_item';
import SettingItemMax from 'components/setting_item_max';

type ChildOption = {
    id: string;
    message: string;
    value: string;
    display: string;
    moreId: string;
    moreMessage: string;
};

type Option = {
    value: string;
    radionButtonText: {
        id: string;
        message: string;
        moreId?: string;
        moreMessage?: string;
    };
    childOption?: ChildOption;
}

type Props ={
    section: string;
    display: string;
    defaultDisplay: string;
    value: string;
    title: {
        id: string;
        message: string;
    };
    firstOption: Option;
    secondOption: Option;
    thirdOption?: Option;
    description: {
        id: string;
        message: string;
        values?: Record<string, React.ReactNode | PrimitiveType | FormatXMLElementFn<React.ReactNode, React.ReactNode>>;
    };
    disabled?: boolean;
    onSubmit?: () => void;
    activeSection?: string;
    handleSubmit: () => void
    isSaving: boolean;
    serverError?: string;
    updateSection: (section: string) => void;
    handleOnChange: (e: React.ChangeEvent, display: {[key: string]: any}) => void;
}

const UserSettingSection = (props: Props) => {
    const {
        section,
        display,
        value,
        title,
        firstOption,
        secondOption,
        thirdOption,
        description,
        disabled,
        onSubmit,
    } = props;
    let extraInfo = null;
    let submit: (() => Promise<void>) | (() => void) | null = onSubmit || props.handleSubmit;

    const firstMessage = (
        <FormattedMessage
            id={firstOption.radionButtonText.id}
            defaultMessage={firstOption.radionButtonText.message}
        />
    );

    let moreColon;
    let firstMessageMore;
    if (firstOption.radionButtonText.moreId) {
        moreColon = ': ';
        firstMessageMore = (
            <span className='font-weight--normal'>
                <FormattedMessage
                    id={firstOption.radionButtonText.moreId}
                    defaultMessage={firstOption.radionButtonText.moreMessage}
                />
            </span>
        );
    }

    const secondMessage = (
        <FormattedMessage
            id={secondOption.radionButtonText.id}
            defaultMessage={secondOption.radionButtonText.message}
        />
    );

    let secondMessageMore;
    if (secondOption.radionButtonText.moreId) {
        secondMessageMore = (
            <span className='font-weight--normal'>
                <FormattedMessage
                    id={secondOption.radionButtonText.moreId}
                    defaultMessage={secondOption.radionButtonText.moreMessage}
                />
            </span>
        );
    }

    let thirdMessage;
    if (thirdOption) {
        thirdMessage = (
            <FormattedMessage
                id={thirdOption.radionButtonText.id}
                defaultMessage={thirdOption.radionButtonText.message}
            />
        );
    }

    const messageTitle = (
        <FormattedMessage
            id={title.id}
            defaultMessage={title.message}
        />
    );

    const messageDesc = (
        <FormattedMessage
            id={description.id}
            defaultMessage={description.message}
            values={description.values}
        />
    );

    const active = props.activeSection === section;
    let max = null;
    if (active) {
        const format = [false, false, false];
        let childOptionToShow: ChildOption | undefined;
        if (value === firstOption.value) {
            format[0] = true;
            childOptionToShow = firstOption.childOption;
        } else if (value === secondOption.value) {
            format[1] = true;
            childOptionToShow = secondOption.childOption;
        } else {
            format[2] = true;
            if (thirdOption) {
                childOptionToShow = thirdOption.childOption;
            }
        }

        const name = section + 'Format';
        const key = section + 'UserDisplay';

        const firstDisplay = {
            [display]: firstOption.value,
        };

        const secondDisplay = {
            [display]: secondOption.value,
        };

        let thirdSection;
        if (thirdOption && thirdMessage) {
            const thirdDisplay = {
                [display]: thirdOption.value,
            };

            thirdSection = (
                <div className='radio'>
                    <label>
                        <input
                            id={name + 'C'}
                            type='radio'
                            name={name}
                            checked={format[2]}
                            onChange={(e) => props.handleOnChange(e, thirdDisplay)}
                        />
                        {thirdMessage}
                    </label>
                    <br/>
                </div>
            );
        }

        let childOptionSection;
        if (childOptionToShow) {
            const childDisplay = childOptionToShow.display;
            childOptionSection = (
                <div className='checkbox'>
                    <hr/>
                    <label>
                        <input
                            id={name + 'childOption'}
                            type='checkbox'
                            name={childOptionToShow.id}
                            checked={childOptionToShow.value === 'true'}
                            onChange={(e) => {
                                props.handleOnChange(e, {[childDisplay]: e.target.checked ? 'true' : 'false'});
                            }}
                        />
                        <FormattedMessage
                            id={childOptionToShow.id}
                            defaultMessage={childOptionToShow.message}
                        />
                        {moreColon}
                        <span className='font-weight--normal'>
                            <FormattedMessage
                                id={childOptionToShow.moreId}
                                defaultMessage={childOptionToShow.moreMessage}
                            />
                        </span>
                    </label>
                    <br/>
                </div>
            );
        }

        let inputs = [
            <fieldset key={key}>
                <legend className='form-legend hidden-label'>
                    {messageTitle}
                </legend>
                <div className='radio'>
                    <label>
                        <input
                            id={name + 'A'}
                            type='radio'
                            name={name}
                            checked={format[0]}
                            onChange={(e) => props.handleOnChange(e, firstDisplay)}
                        />
                        {firstMessage}
                        {moreColon}
                        {firstMessageMore}
                    </label>
                    <br/>
                </div>
                <div className='radio'>
                    <label>
                        <input
                            id={name + 'B'}
                            type='radio'
                            name={name}
                            checked={format[1]}
                            onChange={(e) => props.handleOnChange(e, secondDisplay)}
                        />
                        {secondMessage}
                        {moreColon}
                        {secondMessageMore}
                    </label>
                    <br/>
                </div>
                {thirdSection}
                <div>
                    <br/>
                    {messageDesc}
                </div>
                {childOptionSection}
            </fieldset>,
        ];

        if (display === 'teammateNameDisplay' && disabled) {
            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.display.teammateNameDisplay'
                        defaultMessage='This field is handled through your System Administrator. If you want to change it, you need to do so through your System Administrator.'
                    />
                </span>
            );
            submit = null;
            inputs = [];
        }
        max = (
            <SettingItemMax
                title={messageTitle}
                inputs={inputs}
                submit={submit}
                saving={props.isSaving}
                serverError={props.serverError}
                extraInfo={extraInfo}
                updateSection={props.updateSection}
            />);
    }

    let describe;
    if (value === firstOption.value) {
        describe = firstMessage;
    } else if (value === secondOption.value) {
        describe = secondMessage;
    } else {
        describe = thirdMessage;
    }

    return (
        <div>
            <SettingItem
                active={active}
                areAllSectionsInactive={props.activeSection === ''}
                title={messageTitle}
                describe={describe}
                section={section}
                updateSection={props.updateSection}
                max={max}
            />
            <div className='divider-dark'/>
        </div>
    );
}

export default React.memo(UserSettingSection);
