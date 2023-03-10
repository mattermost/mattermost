// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react'

import {useIntl} from 'react-intl'

import CheckIcon from 'src/widgets/icons/check'

import NotificationBox from 'src/widgets/notificationBox/notificationBox'

import {PublicProps, ViewLimitModal} from './viewLimitDialog'

import './viewLimitDialogWrapper.scss'

type Props = PublicProps & {
    show: boolean
}

const ViewLimitModalWrapper = (props: Props): JSX.Element => {
    const intl = useIntl()
    const [showNotifyAdminSuccessMsg, setShowNotifyAdminSuccessMsg] = useState<boolean>(false)

    const viewLimitDialog = (
        <ViewLimitModal
            onClose={props.onClose}
            showNotifyAdminSuccess={() => setShowNotifyAdminSuccessMsg(true)}
        />
    )

    const successNotificationBox = (
        <NotificationBox
            className='ViewLimitSuccessNotify'
            icon={<CheckIcon/>}
            title={intl.formatMessage({id: 'ViewLimitDialog.notifyAdmin.Success', defaultMessage: 'Your admin has been notified'})}
            onClose={() => setShowNotifyAdminSuccessMsg(false)}
        >
            {null}
        </NotificationBox>
    )

    return (
        <React.Fragment>
            {props.show && viewLimitDialog}
            {showNotifyAdminSuccessMsg && successNotificationBox}
        </React.Fragment>
    )
}

export default ViewLimitModalWrapper
