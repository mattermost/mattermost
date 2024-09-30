// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import Markdown from 'components/markdown';

import './section_notice.scss';

type Button = {
    onClick: () => void;
    text: string;
    isExternal?: boolean;
}
type Props = {
    title: string;
    text: string;
    primaryButton?: Button;
    secondaryButton?: Button;
    linkButton?: Button;
    type?: 'info' | 'success' | 'danger' | 'welcome' | 'warning' | 'hint';
    isDismissable?: boolean;
    onDismissClick?: () => void;
};

const iconByType = {
    info: 'icon-information-outline',
    hint: 'icon-lightbulb-outline',
    success: 'icon-check',
    danger: 'icon-alert-outline',
    warning: 'icon-alert-outline',
    welcome: undefined,
};

const SectionNotice = ({
    title,
    text,
    primaryButton,
    secondaryButton,
    linkButton,
    type = 'info',
    isDismissable,
    onDismissClick,
}: Props) => {
    const intl = useIntl();
    const icon = iconByType[type];
    const showDismiss = Boolean(isDismissable && onDismissClick);
    const buttonClass = 'btn btn-sm sectionNoticeButton';
    const externalIcon = (<i className={'icon icon-open-in-new'}/>);
    return (
        <div className={classNames('sectionNoticeContainer', type)}>
            <div className={'sectionNoticeContent'}>
                {icon && <i className={classNames('icon sectionNoticeIcon', icon, type)}/>}
                <div className='sectionNoticeBody'>
                    <h4 className={classNames('sectionNoticeTitle', {welcome: type === 'welcome'})}>{title}</h4>
                    <Markdown message={text}/>
                    <div className='sectionNoticeActions'>
                        {primaryButton &&
                        <button
                            onClick={primaryButton.onClick}
                            className={classNames(buttonClass, 'btn-primary')}
                        >
                            {primaryButton.text}
                            {primaryButton.isExternal && externalIcon}
                        </button>
                        }
                        {secondaryButton &&
                        <button
                            onClick={secondaryButton.onClick}
                            className={classNames(buttonClass, 'btn-tertiary')}
                        >
                            {secondaryButton.text}
                            {secondaryButton.isExternal && externalIcon}
                        </button>
                        }
                        {linkButton &&
                        <button
                            onClick={linkButton.onClick}
                            className={classNames(buttonClass, 'btn-link')}
                        >
                            {linkButton.text}
                            {linkButton.isExternal && externalIcon}
                        </button>
                        }
                    </div>

                </div>
            </div>
            {showDismiss &&
                <button
                    className='btn btn-icon btn-sm sectionNoticeClose'
                    onClick={onDismissClick}
                    aria-label={intl.formatMessage({
                        id: 'sectionNotice.dismiss',
                        defaultMessage: 'Dismiss notice',
                    })}
                >
                    <i className='icon icon-close'/>
                </button>
            }
        </div>
    );
};

export default SectionNotice;
