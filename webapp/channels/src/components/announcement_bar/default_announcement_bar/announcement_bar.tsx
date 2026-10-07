// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalBanner} from '@mattermost/compass-ui/components/global-banner';
import classNames from 'classnames';
import type {ReactNode} from 'react';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, useIntl} from 'react-intl';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import {AnnouncementBarTypes} from 'utils/constants';
import {isStringContainingUrl} from 'utils/url';

import './default_announcement_bar.scss';

type Props = {
    id?: string;
    showCloseButton: boolean;
    className?: string;
    color: string;
    textColor: string;
    type: string;
    message: ReactNode;
    tooltipMsg?: ReactNode;
    handleClose?: (e?: any) => void;
    showModal?: boolean;
    announcementBarCount?: number;
    onButtonClick?: (e?: any) => void;
    modalButtonText?: MessageDescriptor;
    showLinkAsButton: boolean;
    icon?: ReactNode;
    actions: {
        incrementAnnouncementBarCount: () => void;
        decrementAnnouncementBarCount: () => void;
    };
    showCTA?: boolean;
    ctaText?: ReactNode;
    ctaDisabled?: boolean;
};

type State = {
    showTooltip: boolean;
    isStringContainingUrl: boolean;
};

type GlobalBannerType = 'general' | 'warning' | 'danger' | 'info' | 'success';

function mapAnnouncementBarType(type: string): GlobalBannerType {
    switch (type) {
    case AnnouncementBarTypes.CRITICAL:
    case AnnouncementBarTypes.DEVELOPER:
        return 'danger';
    case AnnouncementBarTypes.SUCCESS:
        return 'success';
    case AnnouncementBarTypes.WARNING:
        return 'warning';
    case AnnouncementBarTypes.ADVISOR:
    case AnnouncementBarTypes.ADVISOR_ACK:
    case AnnouncementBarTypes.ANNOUNCEMENT:
        return 'info';
    default:
        return 'general';
    }
}

function legacyBarClass(type: string): string {
    if (type === AnnouncementBarTypes.DEVELOPER || type === AnnouncementBarTypes.CRITICAL) {
        return 'announcement-bar announcement-bar-critical';
    }
    if (type === AnnouncementBarTypes.SUCCESS) {
        return 'announcement-bar announcement-bar-success';
    }
    if (type === AnnouncementBarTypes.ADVISOR) {
        return 'announcement-bar announcement-bar-advisor';
    }
    if (type === AnnouncementBarTypes.ADVISOR_ACK) {
        return 'announcement-bar announcement-bar-advisor-ack';
    }
    if (type === AnnouncementBarTypes.GENERAL) {
        return 'announcement-bar announcement-bar-general';
    }
    if (type === AnnouncementBarTypes.WARNING) {
        return 'announcement-bar announcement-bar-warning';
    }
    return 'announcement-bar';
}

type AnnouncementBarBodyProps = Props & {
    messageRef: React.RefObject<HTMLDivElement | null>;
    enableToolTipIfNeeded: () => void;
    showTooltip: boolean;
    dismissLabel: string;
};

function AnnouncementBarBody({
    messageRef,
    enableToolTipIfNeeded,
    showTooltip,
    dismissLabel,
    ...props
}: AnnouncementBarBodyProps) {
    let message = props.message;
    if (typeof message === 'string') {
        message = (
            <FormattedMarkdownMessage id={message}/>
        );
    }

    const messageNode = (
        <span
            ref={messageRef}
            onMouseEnter={enableToolTipIfNeeded}
        >
            {message}
        </span>
    );

    const announcementIcon = () => {
        return props.showLinkAsButton &&
            (props.showCloseButton ? <i className='icon icon-alert-circle-outline'/> : <i className='icon icon-alert-outline'/>);
    };

    let actionLabel: ReactNode;
    if (props.showLinkAsButton && props.showCTA && !props.ctaDisabled) {
        if (props.modalButtonText) {
            actionLabel = <FormattedMessage {...props.modalButtonText}/>;
        } else if (props.ctaText) {
            actionLabel = props.ctaText;
        }
    }

    const hasCustomColors = Boolean(props.color && props.textColor);
    const bannerType = hasCustomColors ? 'general' : mapAnnouncementBarType(props.type);

    let barClass = legacyBarClass(props.type);
    const barStyle: React.CSSProperties = {};
    if (hasCustomColors) {
        barStyle.backgroundColor = props.color;
        barStyle.color = props.textColor;
        barClass = 'announcement-bar';
    }

    if (props.className) {
        barClass += ` ${props.className}`;
    }

    const globalBanner = (
        <GlobalBanner
            className={classNames(
                'announcement-bar__compass',
                hasCustomColors ? 'announcement-bar__compass--custom' : barClass,
            )}
            type={bannerType}
            message={messageNode}
            leadingIcon={props.icon ? props.icon : announcementIcon()}
            actionLabel={actionLabel}
            onAction={actionLabel ? () => props.onButtonClick?.() : undefined}
            onDismiss={props.showCloseButton ? () => props.handleClose?.() : undefined}
            dismissLabel={dismissLabel}
        />
    );

    let barContent = hasCustomColors ? (
        <div
            className={barClass}
            style={barStyle}
        >
            {globalBanner}
        </div>
    ) : globalBanner;
    if (showTooltip) {
        barContent = (
            <WithTooltip
                title={props.tooltipMsg ? props.tooltipMsg : message}
                className='announcementBarTooltip'
                delayClose={true}
            >
                {barContent}
            </WithTooltip>
        );
    }

    return (
        <div
            // eslint-disable-next-line react/no-unknown-property
            css={{gridArea: 'announcement'}}
            data-testid={props.id}
        >
            {barContent}
        </div>
    );
}

export default class AnnouncementBar extends React.PureComponent<Props, State> {
    messageRef: React.RefObject<HTMLDivElement | null>;
    constructor(props: Props) {
        super(props);

        this.messageRef = React.createRef();

        this.state = {
            showTooltip: false,
            isStringContainingUrl: false,
        };
    }

    static defaultProps = {
        showCloseButton: false,
        color: '',
        textColor: '',
        type: AnnouncementBarTypes.CRITICAL,
        showLinkAsButton: false,
        isTallBanner: false,
        showCTA: true,
    };

    enableToolTipIfNeeded = () => {
        const elm = this.messageRef.current;
        if (elm) {
            const enable = elm.offsetWidth < elm.scrollWidth;
            this.setState({showTooltip: enable});
            if (typeof this.props.message === 'string') {
                this.setState({isStringContainingUrl: isStringContainingUrl(this.props.message)});
            }
            return;
        }
        this.setState({showTooltip: false});
    };

    componentDidMount() {
        this.props.actions.incrementAnnouncementBarCount();
        document.body.classList.add('announcement-bar--fixed');

        // Set CSS custom property for dynamic height calculation
        const newCount = (this.props.announcementBarCount || 0) + 1;
        document.documentElement.style.setProperty('--announcement-bar-count', newCount.toString());
    }

    componentDidUpdate(prevProps: Props) {
        // Update CSS custom property if count changed
        if (prevProps.announcementBarCount !== this.props.announcementBarCount) {
            const count = this.props.announcementBarCount || 0;
            document.documentElement.style.setProperty('--announcement-bar-count', count.toString());

            // Add/remove class based on count
            if (count > 0) {
                document.body.classList.add('announcement-bar--fixed');
            } else {
                document.body.classList.remove('announcement-bar--fixed');
            }
        }
    }

    componentWillUnmount() {
        this.props.actions.decrementAnnouncementBarCount();
        const newCount = Math.max((this.props.announcementBarCount || 1) - 1, 0);

        // Remove class only when no announcement bars left
        if (newCount === 0) {
            document.body.classList.remove('announcement-bar--fixed');
            document.documentElement.style.removeProperty('--announcement-bar-count');
        } else {
            // Update count
            document.documentElement.style.setProperty('--announcement-bar-count', newCount.toString());
        }
    }

    render() {
        if (!this.props.message) {
            return null;
        }

        return (
            <AnnouncementBarBodyWithIntl
                {...this.props}
                messageRef={this.messageRef}
                enableToolTipIfNeeded={this.enableToolTipIfNeeded}
                showTooltip={this.state.showTooltip}
            />
        );
    }
}

function AnnouncementBarBodyWithIntl(props: Omit<AnnouncementBarBodyProps, 'dismissLabel'>) {
    const {formatMessage} = useIntl();
    const dismissLabel = formatMessage({id: 'general_button.close', defaultMessage: 'Close'});
    return (
        <AnnouncementBarBody
            {...props}
            dismissLabel={dismissLabel}
        />
    );
}
