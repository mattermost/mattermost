// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import classNames from 'classnames';

import type {ChannelType} from '@mattermost/types/channels';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import CheckCircleIcon from 'components/widgets/icons/check_circle_icon';
import GlobeCircleSolidIcon from 'components/widgets/icons/globe_circle_solid_icon';
import LockCircleSolidIcon from 'components/widgets/icons/lock_circle_solid_icon';
import UpgradeBadge from 'components/widgets/icons/upgrade_badge_icon';

import {Constants} from 'utils/constants';

import './public-private-selector.scss';

type BigButtonSelectorProps = {
    id: ChannelType;
    title: string | React.ReactNode;
    description: string | React.ReactNode;
    iconSVG: (props: React.HTMLAttributes<HTMLSpanElement>) => JSX.Element;
    titleClassName?: string;
    descriptionClassName?: string;
    iconClassName?: string;
    tooltip?: string;
    selected?: boolean;
    disabled?: boolean;
    locked?: boolean;
    onClick: (id: ChannelType) => void;
};

const BigButtonSelector = ({
    id,
    title,
    description,
    iconSVG: IconSVG,
    titleClassName,
    descriptionClassName,
    iconClassName,
    tooltip,
    selected,
    disabled,
    locked,
    onClick,
}: BigButtonSelectorProps) => {
    const handleOnClick = useCallback(
        (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            e.preventDefault();
            onClick(id);
        },
        [id, onClick],
    );

    const button = (
        <button
            id={`public-private-selector-button-${id}`}
            className={classNames('public-private-selector-button', {selected, disabled, locked})}
            onClick={handleOnClick}
        >
            <IconSVG className={classNames('public-private-selector-button-icon', iconClassName)}/>
            <div className='public-private-selector-button-text'>
                <div className={classNames('public-private-selector-button-title', titleClassName)}>
                    {title}
                    {locked && <UpgradeBadge className='public-private-selector-button-icon-upgrade'/>}
                </div>
                <div className={classNames('public-private-selector-button-description', descriptionClassName)}>
                    {description}
                </div>
            </div>
            {selected && <CheckCircleIcon className='public-private-selector-button-icon-check'/>}
        </button>
    );

    if (!tooltip) {
        return button;
    }

    const tooltipContainer = (
        <Tooltip id={'public-private-selector-button-tooltip'}>
            {tooltip}
        </Tooltip>
    );

    return (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='top'
            overlay={tooltipContainer}
        >
            {button}
        </OverlayTrigger>
    );
};

type ButtonSelectorProps = {
    title?: string | React.ReactNode;
    description?: string | React.ReactNode;
    titleClassName?: string;
    descriptionClassName?: string;
    iconClassName?: string;
    tooltip?: string;
    selected?: boolean;
    disabled?: boolean;
    locked?: boolean;
};

type PublicPrivateSelectorProps = {
    selected: ChannelType;
    className?: string;
    publicButtonProps?: ButtonSelectorProps;
    privateButtonProps?: ButtonSelectorProps;
    onChange: (selected: ChannelType) => void;
};

const PublicPrivateSelector = ({
    selected,
    className,
    publicButtonProps: {
        title: titlePublic,
        description: descriptionPublic,
        titleClassName: titleClassNamePublic,
        descriptionClassName: descriptionClassNamePublic,
        iconClassName: iconClassNamePublic,
        tooltip: tooltipPublic,
        disabled: disabledPublic,
        locked: lockedPublic,
    } = {} as ButtonSelectorProps,
    privateButtonProps: {
        title: titlePrivate,
        description: descriptionPrivate,
        titleClassName: titleClassNamePrivate,
        descriptionClassName: descriptionClassNamePrivate,
        iconClassName: iconClassNamePrivate,
        tooltip: tooltipPrivate,
        disabled: disabledPrivate,
        locked: lockedPrivate,
    } = {} as ButtonSelectorProps,
    onChange,
}: PublicPrivateSelectorProps) => {
    const {formatMessage} = useIntl();

    const canSelectPublic = !disabledPublic && !lockedPublic;
    const canSelectPrivate = !disabledPrivate && !lockedPrivate;

    const handleOnClick = useCallback(
        (selection: ChannelType) => {
            if (
                selection === selected ||
                (selection === Constants.OPEN_CHANNEL && !canSelectPublic) ||
                (selection === Constants.PRIVATE_CHANNEL && !canSelectPrivate)
            ) {
                return;
            }

            onChange(selection);
        },
        [selected, canSelectPublic, canSelectPrivate, onChange],
    );

    return (
        <div className={classNames('public-private-selector', className)}>
            <BigButtonSelector
                id={Constants.OPEN_CHANNEL as ChannelType}
                title={titlePublic || formatMessage({id: 'public_private_selector.public.title', defaultMessage: 'Public'})}
                description={descriptionPublic || formatMessage({id: 'public_private_selector.public.description', defaultMessage: 'Anyone'})}
                iconSVG={GlobeCircleSolidIcon}
                titleClassName={titleClassNamePublic}
                descriptionClassName={descriptionClassNamePublic}
                iconClassName={iconClassNamePublic}
                tooltip={tooltipPublic}
                selected={selected === Constants.OPEN_CHANNEL}
                disabled={disabledPublic}
                locked={lockedPublic}
                onClick={handleOnClick}
            />
            <BigButtonSelector
                id={Constants.PRIVATE_CHANNEL as ChannelType}
                title={titlePrivate || formatMessage({id: 'public_private_selector.private.title', defaultMessage: 'Private'})}
                description={descriptionPrivate || formatMessage({id: 'public_private_selector.private.description', defaultMessage: 'Only invited members'})}
                iconSVG={LockCircleSolidIcon}
                titleClassName={titleClassNamePrivate}
                descriptionClassName={descriptionClassNamePrivate}
                iconClassName={iconClassNamePrivate}
                tooltip={tooltipPrivate}
                selected={selected === Constants.PRIVATE_CHANNEL}
                disabled={disabledPrivate}
                locked={lockedPrivate}
                onClick={handleOnClick}
            />
        </div>
    );
};

export default PublicPrivateSelector;
