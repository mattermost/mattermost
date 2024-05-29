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
}
type Props = {
    title: string;
    text: string;
    primaryButton?: Button;
    secondaryButton?: Button;
    linkButton?: Button;
    type?: 'info' | 'success' | 'danger' | 'welcome' | 'warning';
    isDismissable?: boolean;
    onDismissClick?: () => void;
};

const iconByType = {
    info: 'icon-information-outline',
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
                        </button>
                        }
                        {secondaryButton &&
                        <button
                            onClick={secondaryButton.onClick}
                            className={classNames(buttonClass, 'btn-secondary')}
                        >
                            {secondaryButton.text}
                        </button>
                        }
                        {linkButton &&
                        <button
                            onClick={linkButton.onClick}
                            className={classNames(buttonClass, 'btn-link')}
                        >
                            {linkButton.text}
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
