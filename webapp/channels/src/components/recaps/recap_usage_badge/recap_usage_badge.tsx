import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    useHover,
    useFocus,
    useDismiss,
    useInteractions,
    FloatingPortal,
} from '@floating-ui/react';

import {getRecapLimitStatus} from 'mattermost-redux/selectors/entities/recaps';

import './recap_usage_badge.scss';

type BadgeState = 'normal' | 'warning' | 'error';

const RecapUsageBadge = () => {
    const {formatMessage, formatTime} = useIntl();
    const limitStatus = useSelector(getRecapLimitStatus);
    const [isOpen, setIsOpen] = useState(false);

    const {refs, floatingStyles, context} = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        middleware: [offset(8), flip(), shift()],
        whileElementsMounted: autoUpdate,
        placement: 'bottom-end',
    });

    const hover = useHover(context, {move: false});
    const focus = useFocus(context);
    const dismiss = useDismiss(context);

    const {getReferenceProps, getFloatingProps} = useInteractions([
        hover,
        focus,
        dismiss,
    ]);

    if (!limitStatus) {
        return null;
    }

    const {daily, cooldown} = limitStatus;
    const isUnlimited = daily.limit === -1;

    // Calculate badge state
    let badgeState: BadgeState = 'normal';
    if (!isUnlimited) {
        const usageRatio = daily.used / daily.limit;
        if (daily.used >= daily.limit) {
            badgeState = 'error';
        } else if (usageRatio >= 0.8) {
            badgeState = 'warning';
        }
    }

    // Also show error state if cooldown is active
    if (cooldown.is_active) {
        badgeState = 'error';
    }

    // Format badge text
    const badgeText = isUnlimited
        ? `${daily.used}`
        : `${daily.used}/${daily.limit}`;

    // Format reset time (midnight in user timezone)
    const resetTime = new Date(daily.reset_at);
    const formattedResetTime = formatTime(resetTime, {
        hour: 'numeric',
        minute: '2-digit',
    });

    // Format cooldown available time
    const cooldownTime = cooldown.is_active
        ? new Date(cooldown.available_at)
        : null;
    const formattedCooldownTime = cooldownTime
        ? formatTime(cooldownTime, {hour: 'numeric', minute: '2-digit'})
        : null;

    // Calculate relative cooldown time
    const cooldownRelative = cooldown.is_active
        ? formatCooldownRelative(cooldown.retry_after_seconds, formatMessage)
        : null;

    return (
        <>
            <button
                ref={refs.setReference}
                className={`RecapUsageBadge RecapUsageBadge--${badgeState}`}
                {...getReferenceProps()}
                aria-label={formatMessage({
                    id: 'recaps.usageBadge.ariaLabel',
                    defaultMessage: 'Daily recap usage: {used} of {limit}',
                }, {used: daily.used, limit: isUnlimited ? 'unlimited' : daily.limit})}
            >
                <i className='icon icon-clock-outline'/>
                <span className='RecapUsageBadge__text'>{badgeText}</span>
            </button>

            {isOpen && (
                <FloatingPortal>
                    <div
                        ref={refs.setFloating}
                        className='RecapUsageBadge__popover'
                        style={floatingStyles}
                        {...getFloatingProps()}
                    >
                        <div className='RecapUsageBadge__popover-header'>
                            <FormattedMessage
                                id='recaps.usageBadge.popover.title'
                                defaultMessage='Daily recap usage'
                            />
                        </div>
                        <div className='RecapUsageBadge__popover-body'>
                            <div className='RecapUsageBadge__popover-usage'>
                                {isUnlimited ? (
                                    <FormattedMessage
                                        id='recaps.usageBadge.popover.unlimited'
                                        defaultMessage='{used} recaps today (no limit)'
                                        values={{used: daily.used}}
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='recaps.usageBadge.popover.usage'
                                        defaultMessage='{used} of {limit} recaps used today'
                                        values={{used: daily.used, limit: daily.limit}}
                                    />
                                )}
                            </div>

                            {badgeState === 'warning' && !cooldown.is_active && (
                                <div className='RecapUsageBadge__popover-warning'>
                                    <i className='icon icon-alert-outline'/>
                                    <FormattedMessage
                                        id='recaps.usageBadge.popover.approachingLimit'
                                        defaultMessage='Approaching daily limit'
                                    />
                                </div>
                            )}

                            {badgeState === 'error' && daily.used >= daily.limit && !isUnlimited && (
                                <div className='RecapUsageBadge__popover-error'>
                                    <i className='icon icon-alert-circle-outline'/>
                                    <FormattedMessage
                                        id='recaps.usageBadge.popover.limitReached'
                                        defaultMessage='Daily limit reached. Resets at {time}.'
                                        values={{time: formattedResetTime}}
                                    />
                                </div>
                            )}

                            {cooldown.is_active && (
                                <div className='RecapUsageBadge__popover-cooldown'>
                                    <i className='icon icon-timer-outline'/>
                                    <FormattedMessage
                                        id='recaps.usageBadge.popover.cooldown'
                                        defaultMessage='Available again in {relative} ({time})'
                                        values={{
                                            relative: cooldownRelative,
                                            time: formattedCooldownTime,
                                        }}
                                    />
                                </div>
                            )}

                            {!isUnlimited && badgeState !== 'error' && !cooldown.is_active && (
                                <div className='RecapUsageBadge__popover-reset'>
                                    <FormattedMessage
                                        id='recaps.usageBadge.popover.resetTime'
                                        defaultMessage='Resets at {time}'
                                        values={{time: formattedResetTime}}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </FloatingPortal>
            )}
        </>
    );
};

// Helper to format cooldown as relative time
function formatCooldownRelative(
    seconds: number,
    formatMessage: ReturnType<typeof useIntl>['formatMessage']
): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return formatMessage(
            {id: 'recaps.cooldown.hoursMinutes', defaultMessage: '~{hours}h {minutes}m'},
            {hours, minutes}
        );
    }
    return formatMessage(
        {id: 'recaps.cooldown.minutes', defaultMessage: '~{minutes}m'},
        {minutes: Math.max(1, minutes)}
    );
}

export default RecapUsageBadge;
