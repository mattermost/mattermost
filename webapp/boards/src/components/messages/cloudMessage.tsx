// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {useIntl, FormattedMessage} from 'react-intl'

import IconButton from 'src/widgets/buttons/iconButton'
import Button from 'src/widgets/buttons/button'

import CloseIcon from 'src/widgets/icons/close'

import {useAppSelector, useAppDispatch} from 'src/store/hooks'
import octoClient from 'src/octoClient'
import {IUser, UserConfigPatch} from 'src/user'
import {getMe, patchProps, getCloudMessageCanceled} from 'src/store/users'
import {UserSettings} from 'src/userSettings'

import CompassIcon from 'src/widgets/icons/compassIcon'
import TelemetryClient, {TelemetryCategory, TelemetryActions} from 'src/telemetry/telemetryClient'

import './cloudMessage.scss'
const signupURL = 'https://mattermost.com/pricing'
const displayAfter = (1000 * 60 * 60 * 24) //24 hours

const CloudMessage = () => {
    const intl = useIntl()
    const dispatch = useAppDispatch()
    const me = useAppSelector<IUser|null>(getMe)
    const cloudMessageCanceled = useAppSelector(getCloudMessageCanceled)

    const closeDialogText = intl.formatMessage({
        id: 'Dialog.closeDialog',
        defaultMessage: 'Close dialog',
    })

    const onClose = async () => {
        if (me) {
            if (me.id === 'single-user') {
                UserSettings.hideCloudMessage = true
                dispatch(patchProps([
                    {
                        user_id: me.id,
                        category: 'focalboard',
                        name: 'cloudMessageCanceled',
                        value: 'true',
                    },
                ]))
                return
            }
            const patch: UserConfigPatch = {
                updatedFields: {
                    cloudMessageCanceled: 'true',
                },
            }

            const patchedProps = await octoClient.patchUserConfig(me.id, patch)
            if (patchedProps) {
                dispatch(patchProps(patchedProps))
            }
        }
    }

    if (cloudMessageCanceled) {
        return null
    }

    if (me) {
        const installTime = Date.now() - me.create_at
        if (installTime < displayAfter) {
            return null
        }
    }

    return (
        <div className='CloudMessage'>
            <div className='banner'>
                <CompassIcon
                    icon='information-outline'
                    className='CompassIcon'
                />
                <FormattedMessage
                    id='CloudMessage.cloud-server'
                    defaultMessage='Get your own free cloud server.'
                />

                <Button
                    title='Learn more'
                    size='xsmall'
                    emphasis='primary'
                    onClick={() => {
                        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.CloudMoreInfo)
                        window.open(signupURL)
                    }}
                >
                    <FormattedMessage
                        id='cloudMessage.learn-more'
                        defaultMessage='Learn more'
                    />
                </Button>

            </div>

            <IconButton
                className='margin-right'
                onClick={onClose}
                icon={<CloseIcon/>}
                title={closeDialogText}
                size='small'
            />
        </div>
    )
}
export default React.memo(CloudMessage)
