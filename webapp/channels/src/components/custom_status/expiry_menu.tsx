// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CustomStatusDuration} from '@mattermost/types/users';
import React, {useState, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {durationValues} from 'utils/constants';

import ExpiryTime from './expiry_time';

type ExpiryMenuItem = {
    text: string;
    value: string;
}

type Props = {
    duration: CustomStatusDuration;
    expiryTime?: string;
    handleDurationChange: (expiryValue: CustomStatusDuration) => void;
}

const {
    DONT_CLEAR,
    THIRTY_MINUTES,
    ONE_HOUR,
    FOUR_HOURS,
    TODAY,
    THIS_WEEK,
    DATE_AND_TIME,
    CUSTOM_DATE_TIME,
} = CustomStatusDuration;

const ExpiryMenu: React.FC<Props> = (props: Props) => {
    const {duration, handleDurationChange, expiryTime} = props;
    const {formatMessage} = useIntl();
    const [menuItems, setMenuItems] = useState<JSX.Element[]>([]);

    const expiryMenuItems: { [key in CustomStatusDuration]?: ExpiryMenuItem } = {
        [DONT_CLEAR]: {
            text: formatMessage(durationValues[DONT_CLEAR]),
            value: formatMessage(durationValues[DONT_CLEAR]),
        },
        [THIRTY_MINUTES]: {
            text: formatMessage(durationValues[THIRTY_MINUTES]),
            value: formatMessage(durationValues[THIRTY_MINUTES]),
        },
        [ONE_HOUR]: {
            text: formatMessage(durationValues[ONE_HOUR]),
            value: formatMessage(durationValues[ONE_HOUR]),
        },
        [FOUR_HOURS]: {
            text: formatMessage(durationValues[FOUR_HOURS]),
            value: formatMessage(durationValues[FOUR_HOURS]),
        },
        [TODAY]: {
            text: formatMessage(durationValues[TODAY]),
            value: formatMessage(durationValues[TODAY]),
        },
        [THIS_WEEK]: {
            text: formatMessage(durationValues[THIS_WEEK]),
            value: formatMessage(durationValues[THIS_WEEK]),
        },
        [CUSTOM_DATE_TIME]: {
            text: formatMessage({id: 'custom_status.expiry_dropdown.choose_date_and_time', defaultMessage: 'Choose date and time'}),
            value: formatMessage(durationValues[CUSTOM_DATE_TIME]),
        },
    };

    useEffect(() => {
        const menuItemArray = Object.keys(expiryMenuItems).map((item, index) => (
            <Menu.ItemAction
                key={item.toString()}
                onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                    event.preventDefault();
                    handleDurationChange(item as CustomStatusDuration);
                }}
                ariaLabel={expiryMenuItems[item as CustomStatusDuration]?.text.toLowerCase()}
                text={expiryMenuItems[item as CustomStatusDuration]?.text}
                id={`expiry_menu_item_${index}`}
            />
        ));

        setMenuItems(menuItemArray);
    }, []);

    return (
        <div className='statusExpiry'>
            <div className='statusExpiry__content'>
                <MenuWrapper
                    className={'statusExpiry__menu'}
                >
                    <button className='style--none expiry-wrapper expiry-selector'>
                        <FormattedMessage
                            id='custom_status.expiry_dropdown.clear_after'
                            defaultMessage='Clear after'
                        />{': '}
                        {expiryTime && duration !== DONT_CLEAR ? (
                            <ExpiryTime
                                time={expiryTime}
                                className='expiry-value'
                                showPrefix={false}
                            />
                        ) : (
                            <span className='expiry-value'>
                                {expiryMenuItems[duration === DATE_AND_TIME ? CUSTOM_DATE_TIME : duration]?.value}
                            </span>
                        )}
                        <span>
                            <i
                                className='fa fa-angle-down'
                                aria-hidden='true'
                            />
                        </span>
                    </button>
                    <Menu
                        ariaLabel={formatMessage({id: 'custom_status.expiry_dropdown.clear_after', defaultMessage: 'Clear after'})}
                        id='statusExpiryMenu'
                    >
                        <Menu.Group>
                            {menuItems}
                        </Menu.Group>
                    </Menu>
                </MenuWrapper>
            </div>
        </div>
    );
};

export default ExpiryMenu;
