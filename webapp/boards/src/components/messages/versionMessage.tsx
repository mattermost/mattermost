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
import {
    getMe,
    patchProps,
    getVersionMessageCanceled,
    versionProperty
} from 'src/store/users'

import CompassIcon from 'src/widgets/icons/compassIcon'
import TelemetryClient, {TelemetryCategory, TelemetryActions} from 'src/telemetry/telemetryClient'

import './versionMessage.scss'
const helpURL = 'https://mattermost.com/pl/whats-new-boards/'

const VersionMessage = () => {
    const intl = useIntl()
    const dispatch = useAppDispatch()
    const me = useAppSelector<IUser|null>(getMe)
    const versionMessageCanceled = useAppSelector(getVersionMessageCanceled)

    if (!me || me.id === 'single-user' || versionMessageCanceled) {
        return null
    }

    const closeDialogText = intl.formatMessage({
        id: 'Dialog.closeDialog',
        defaultMessage: 'Close dialog',
    })

    const onClose = async () => {
        if (me) {
            const patch: UserConfigPatch = {
                updatedFields: {
                    [versionProperty]: 'true',
                },
            }
            const patchedProps = await octoClient.patchUserConfig(me.id, patch)
            if (patchedProps) {
                dispatch(patchProps(patchedProps))
            }
        }
    }

    return (
        <div className='VersionMessage'>
            <div className='banner'>
                <CompassIcon
                    icon='information-outline'
                    className='CompassIcon'
                />
                <FormattedMessage
                    id='VersionMessage.help'
                    defaultMessage="Check out what's new in this version."
                />

                <Button
                    title='Learn more'
                    size='xsmall'
                    emphasis='primary'
                    onClick={() => {
                        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.VersionMoreInfo)
                        window.open(helpURL)
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
export default React.memo(VersionMessage)
