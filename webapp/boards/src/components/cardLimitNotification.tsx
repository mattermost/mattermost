// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useEffect, useState} from 'react'
import {useIntl, FormattedMessage} from 'react-intl'

import AlertIcon from 'src/widgets/icons/alert'

import {useAppSelector, useAppDispatch} from 'src/store/hooks'
import {IUser, UserConfigPatch} from 'src/user'
import {
    getMe,
    patchProps,
    getCardLimitSnoozeUntil,
    getCardHiddenWarningSnoozeUntil
} from 'src/store/users'
import {getCurrentBoardHiddenCardsCount, getCardHiddenWarning} from 'src/store/cards'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'
import CheckIcon from 'src/widgets/icons/check'
import NotificationBox from 'src/widgets/notificationBox/notificationBox'
import octoClient from 'src/octoClient'

import './cardLimitNotification.scss'

type Props = {
    showHiddenCardNotification: boolean
    hiddenCardCountNotificationHandler: (show: boolean) => void
}

const snoozeTime = 1000 * 60 * 60 * 24 * 10
const checkSnoozeInterval = 1000 * 60 * 5

const CardLimitNotification = (props: Props) => {
    const intl = useIntl()
    const [time, setTime] = useState(Date.now())
    const [showNotifyAdminSuccess, setShowNotifyAdminSuccess] = useState<boolean>(false)

    const hiddenCards = useAppSelector<number>(getCurrentBoardHiddenCardsCount)
    const cardHiddenWarning = useAppSelector<boolean>(getCardHiddenWarning)
    const me = useAppSelector<IUser|null>(getMe)
    const snoozedUntil = useAppSelector<number>(getCardLimitSnoozeUntil)
    const snoozedCardHiddenWarningUntil = useAppSelector<number>(getCardHiddenWarningSnoozeUntil)
    const dispatch = useAppDispatch()

    const onCloseHidden = useCallback(async () => {
        if (me) {
            const patch: UserConfigPatch = {
                updatedFields: {
                    cardLimitSnoozeUntil: `${Date.now() + snoozeTime}`,
                },
            }

            const patchedProps = await octoClient.patchUserConfig(me.id, patch)
            if (patchedProps) {
                dispatch(patchProps(patchedProps))
            }
        }
    }, [me])

    const onCloseWarning = useCallback(async () => {
        if (me) {
            const patch: UserConfigPatch = {
                updatedFields: {
                    cardHiddenWarningSnoozeUntil: `${Date.now() + snoozeTime}`,
                },
            }

            const patchedProps = await octoClient.patchUserConfig(me.id, patch)
            if (patchedProps) {
                dispatch(patchProps(patchedProps))
            }
        }
    }, [me])

    let show = false
    let onClose = onCloseHidden
    let title = intl.formatMessage(
        {
            id: 'notification-box-card-limit-reached.title',
            defaultMessage: '{cards} cards hidden from board',
        },
        {cards: hiddenCards},
    )

    if (!show && props.showHiddenCardNotification) {
        show = true
    }

    if (hiddenCards > 0 && time > snoozedUntil) {
        show = true
    }

    if (!show && cardHiddenWarning) {
        show = time > snoozedCardHiddenWarningUntil
        onClose = onCloseWarning
        title = intl.formatMessage(
            {
                id: 'notification-box-cards-hidden.title',
                defaultMessage: 'This action has hidden another card',
            },
        )
    }

    useEffect(() => {
        if (!show) {
            const interval = setInterval(() => setTime(Date.now()), checkSnoozeInterval)
            return () => {
                clearInterval(interval)
            }
        }
        return () => null
    }, [show])

    useEffect(() => {
        if (show) {
            TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.LimitCardLimitReached, {})
        }
    }, [show])

    const handleContactAdminClicked = useCallback(async () => {
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.LimitCardCTAPerformed)

        await octoClient.notifyAdminUpgrade()
        setShowNotifyAdminSuccess(true)
    }, [me?.id])

    const onClick = useCallback(() => {
        (window as any).openPricingModal()({trackingLocation: 'boards > card_limit_notification_upgrade_to_a_paid_plan_click'})
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.LimitCardLimitLinkOpen, {})
    }, [])

    const hasPermissionToUpgrade = me?.roles?.split(' ').indexOf('system_admin') !== -1

    if (!show) {
        return null
    }

    const hidHiddenCardNotification = () => {
        show = false
        props.hiddenCardCountNotificationHandler(false)
    }

    return (
        <NotificationBox
            icon={<AlertIcon/>}
            title={title}
            onClose={props.showHiddenCardNotification ? hidHiddenCardNotification : onClose}
            closeTooltip={props.showHiddenCardNotification ? '' : intl.formatMessage({
                id: 'notification-box-card-limit-reached.close-tooltip',
                defaultMessage: 'Snooze for 10 days',
            })}
        >
            {hasPermissionToUpgrade &&
                <FormattedMessage
                    id='notification-box.card-limit-reached.text'
                    defaultMessage='Card limit reached, to view older cards, {link}'
                    values={{
                        link: (
                            <a
                                onClick={onClick}
                            >
                                <FormattedMessage
                                    id='notification-box-card-limit-reached.link'
                                    defaultMessage='Upgrade to a paid plan'
                                />
                            </a>),
                    }}
                />}
            {!hasPermissionToUpgrade &&
                <FormattedMessage
                    id='notification-box.card-limit-reached.not-admin.text'
                    defaultMessage='To access archived cards, you can {contactLink} to upgrade to a paid plan.'
                    values={{
                        contactLink: (
                            <a
                                onClick={handleContactAdminClicked}
                            >
                                <FormattedMessage
                                    id='notification-box-card-limit-reached.contact-link'
                                    defaultMessage='notify your admin'
                                />
                            </a>),
                    }}
                />}

            {showNotifyAdminSuccess &&
                <NotificationBox
                    className='NotifyAdminSuccessNotify'
                    icon={<CheckIcon/>}
                    title={intl.formatMessage({id: 'ViewLimitDialog.notifyAdmin.Success', defaultMessage: 'Your admin has been notified'})}
                    onClose={() => setShowNotifyAdminSuccess(false)}
                />}
        </NotificationBox>
    )
}

export default React.memo(CardLimitNotification)
