// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'
import {
    Link,
    Redirect,
    useLocation,
    useHistory
} from 'react-router-dom'
import {FormattedMessage} from 'react-intl'

import {useAppDispatch, useAppSelector} from 'src/store/hooks'
import {fetchMe, getLoggedIn} from 'src/store/users'

import Button from 'src/widgets/buttons/button'
import client from 'src/octoClient'
import './loginPage.scss'

const LoginPage = () => {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const dispatch = useAppDispatch()
    const loggedIn = useAppSelector<boolean|null>(getLoggedIn)
    const queryParams = new URLSearchParams(useLocation().search)
    const history = useHistory()

    const handleLogin = async (): Promise<void> => {
        const logged = await client.login(username, password)
        if (logged) {
            await dispatch(fetchMe())
            if (queryParams) {
                history.push(queryParams.get('r') || '/')
            } else {
                history.push('/')
            }
        } else {
            setErrorMessage('Login failed')
        }
    }

    if (loggedIn) {
        return <Redirect to={'/'}/>
    }

    return (
        <div className='LoginPage'>
            <form
                onSubmit={(e: React.FormEvent) => {
                    e.preventDefault()
                    handleLogin()
                }}
            >
                <div className='title'>
                    <FormattedMessage
                        id='login.log-in-title'
                        defaultMessage='Log in'
                    />
                </div>
                <div className='username'>
                    <input
                        id='login-username'
                        placeholder={'Enter username'}
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value)
                            setErrorMessage('')
                        }}
                    />
                </div>
                <div className='password'>
                    <input
                        id='login-password'
                        type='password'
                        placeholder={'Enter password'}
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value)
                            setErrorMessage('')
                        }}
                    />
                </div>
                <Button
                    filled={true}
                    submit={true}
                >
                    <FormattedMessage
                        id='login.log-in-button'
                        defaultMessage='Log in'
                    />
                </Button>
            </form>
            <Link to='/register'>
                <FormattedMessage
                    id='login.register-button'
                    defaultMessage={'or create an account if you don\'t have one'}
                />
            </Link>
            {errorMessage &&
                <div className='error'>
                    {errorMessage}
                </div>
            }
        </div>
    )
}

export default React.memo(LoginPage)
