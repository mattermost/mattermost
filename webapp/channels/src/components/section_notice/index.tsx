// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';

import {SectionNotice as CompassSectionNotice} from '@mattermost/compass-ui/components/section-notice';
import type {SectionNoticeType} from '@mattermost/compass-ui/components/section-notice';

import Markdown from 'components/markdown';

import SectionNoticeButton from './section_notice_button';
import type {SectionNoticeButtonProp} from './types';

import './section_notice.scss';

type LegacySectionNoticeType = 'info' | 'success' | 'danger' | 'welcome' | 'warning' | 'hint';

type Props = {
    title: string | React.ReactElement<any>;
    text?: string;
    children?: React.ReactNode;
    primaryButton?: SectionNoticeButtonProp;
    secondaryButton?: SectionNoticeButtonProp;
    tertiaryButton?: SectionNoticeButtonProp;
    linkButton?: SectionNoticeButtonProp;
    type?: LegacySectionNoticeType;
    iconOverride?: string;
    isDismissable?: boolean;
    onDismissClick?: () => void;
};

function mapNoticeType(type: LegacySectionNoticeType): SectionNoticeType {
    if (type === 'welcome') {
        return 'hint';
    }
    return type;
}

function buttonLabel(button: SectionNoticeButtonProp): React.ReactNode {
    return (
        <>
            {button.leadingIcon && <i className={classNames('icon', button.leadingIcon)}/>}
            {button.text}
            {button.trailingIcon && <i className={classNames('icon', button.trailingIcon)}/>}
        </>
    );
}

const SectionNotice = ({
    title,
    text,
    children,
    primaryButton,
    secondaryButton,
    tertiaryButton,
    linkButton,
    type = 'info',
    iconOverride,
    isDismissable,
    onDismissClick,
}: Props) => {
    const intl = useIntl();
    const compassType = mapNoticeType(type);

    const description = useMemo(() => {
        if (!text && !children) {
            return undefined;
        }
        return (
            <>
                {text && <Markdown message={text}/>}
                {children}
            </>
        );
    }, [text, children]);

    const compassSecondary = secondaryButton ?? (!secondaryButton && tertiaryButton ? tertiaryButton : undefined);
    const extraTertiary = secondaryButton && tertiaryButton ? tertiaryButton : undefined;

    const icon = useMemo(() => {
        if (type === 'welcome' && !iconOverride) {
            return null;
        }
        if (iconOverride) {
            return <i className={classNames('icon', iconOverride)} aria-hidden={true}/>;
        }
        return undefined;
    }, [iconOverride, type]);

    const showDismiss = Boolean(isDismissable && onDismissClick);
    const hasExtraActions = Boolean(extraTertiary || linkButton);

    return (
        <div className={classNames('sectionNoticeContainer', type)}>
            <CompassSectionNotice
                type={compassType}
                icon={icon}
                title={title}
                description={description}
                primaryButtonLabel={primaryButton ? buttonLabel(primaryButton) : undefined}
                onPrimaryAction={primaryButton?.onClick}
                primaryActionDisabled={primaryButton?.disabled}
                primaryActionLoading={primaryButton?.loading}
                secondaryButtonLabel={compassSecondary ? buttonLabel(compassSecondary) : undefined}
                onSecondaryAction={compassSecondary?.onClick}
                secondaryActionDisabled={compassSecondary?.disabled}
                secondaryActionLoading={compassSecondary?.loading}
                onDismiss={showDismiss ? onDismissClick : undefined}
                dismissLabel={intl.formatMessage({
                    id: 'sectionNotice.dismiss',
                    defaultMessage: 'Dismiss notice',
                })}
            />
            {hasExtraActions && (
                <div className='sectionNoticeExtraActions'>
                    {extraTertiary && (
                        <SectionNoticeButton
                            button={extraTertiary}
                            emphasis='tertiary'
                        />
                    )}
                    {linkButton && (
                        <SectionNoticeButton
                            button={linkButton}
                            buttonClass='btn-link'
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default SectionNotice;
