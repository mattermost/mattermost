// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import Markdown from 'components/markdown';

import SectionNoticeButton from './section_notice_button';
import type {SectionNoticeButtonProp} from './types';

import './section_notice.scss';

type Props = {
    title: string | React.ReactElement;
    text?: string;
    primaryButton?: SectionNoticeButtonProp;
    secondaryButton?: SectionNoticeButtonProp;
    tertiaryButton?: SectionNoticeButtonProp;
    linkButton?: SectionNoticeButtonProp;
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
    tertiaryButton,
    linkButton,
    type = 'info',
    isDismissable,
    onDismissClick,
}: Props) => {
    const intl = useIntl();
    const icon = iconByType[type];
    const showDismiss = Boolean(isDismissable && onDismissClick);
    const hasButtons = Boolean(primaryButton || secondaryButton || tertiaryButton || linkButton);
    return (
        <div className={classNames('sectionNoticeContainer', type)}>
            <div className={'sectionNoticeContent'}>
                {icon && <i className={classNames('icon sectionNoticeIcon', icon, type)}/>}
                <div className='sectionNoticeBody'>
                    <h4 className={classNames('sectionNoticeTitle', {welcome: type === 'welcome', noText: !text})}>{title}</h4>
                    {text && <Markdown message={text}/>}
                    {hasButtons && (
                        <div className='sectionNoticeActions'>
                            {primaryButton &&
                                <SectionNoticeButton
                                    button={primaryButton}
                                    buttonClass='btn-primary'
                                />
                            }
                            {secondaryButton &&
                                <SectionNoticeButton
                                    button={secondaryButton}
                                    buttonClass='btn-secondary'
                                />
                            }
                            {tertiaryButton && (
                                <SectionNoticeButton
                                    button={tertiaryButton}
                                    buttonClass='btn-tertiary'
                                />
                            )}
                            {linkButton &&
                                <SectionNoticeButton
                                    button={linkButton}
                                    buttonClass='btn-link'
                                />
                            }
                        </div>
                    )}
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
