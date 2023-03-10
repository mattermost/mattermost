// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {ComponentProps} from 'react'
import {Redirect, Route as BaseRoute} from 'react-router-dom'

import {getLoggedIn, getMe, getMyConfig} from 'src/store/users'
import {useAppSelector} from 'src/store/hooks'
import {UserSettingKey} from 'src/userSettings'
import {IUser} from 'src/user'
import {getClientConfig} from 'src/store/clientConfig'
import {ClientConfig} from 'src/config/clientConfig'


type RouteProps = ComponentProps<typeof BaseRoute> & {
    getOriginalPath?: (match: any) => string
    loginRequired?: boolean
}

function Route({children, ...props}: RouteProps) {
    const loggedIn = useAppSelector<boolean|null>(getLoggedIn)
    const me = useAppSelector<IUser|null>(getMe)
    const myConfig = useAppSelector(getMyConfig)
    const clientConfig = useAppSelector<ClientConfig>(getClientConfig)

    let redirect: RouteProps['children']

    // No FTUE for guests
    const disableTour = me?.is_guest || clientConfig?.featureFlags?.disableTour || false

    const showWelcomePage = !disableTour &&
        (me?.id !== 'single-user') &&
        props.path !== '/welcome' &&
        loggedIn === true &&
        !myConfig[UserSettingKey.WelcomePageViewed]

    if (showWelcomePage) {
        // eslint-disable-next-line react/display-name, react/prop-types
        redirect = ({match}) => {
            if (props.getOriginalPath) {
                return <Redirect to={`/welcome?r=${props.getOriginalPath(match)}`}/>
            }
            return <Redirect to='/welcome'/>
        }
    }

    if (redirect === null && loggedIn === false && props.loginRequired) {
        // eslint-disable-next-line react/display-name, react/prop-types
        redirect = ({match}) => {
            if (props.getOriginalPath) {
                let redirectUrl = '/' + props.getOriginalPath(match)
                if (redirectUrl.indexOf('//') === 0) {
                    redirectUrl = redirectUrl.slice(1)
                }
                const loginUrl = `/error?id=not-logged-in&r=${encodeURIComponent(redirectUrl)}`
                return <Redirect to={loginUrl}/>
            }
            return <Redirect to='/error?id=not-logged-in'/>
        }
    }

    return (
        <BaseRoute {...props}>
            {redirect || children}
        </BaseRoute>
    )
}

export default React.memo(Route)
