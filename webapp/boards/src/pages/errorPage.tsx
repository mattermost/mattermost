// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback} from 'react'
import {useHistory, useLocation} from 'react-router-dom'
import {FormattedMessage} from 'react-intl'

import ErrorIllustration from 'src/svg/error-illustration'

import Button from 'src/widgets/buttons/button'
import './errorPage.scss'

import {ErrorId, errorDefFromId} from 'src/errors'

const ErrorPage = () => {
    const history = useHistory()
    const queryParams = new URLSearchParams(useLocation().search)
    const errid = queryParams.get('id')
    const errorDef = errorDefFromId(errid as ErrorId)

    const handleButtonClick = useCallback((path: string | ((params: URLSearchParams) => string)) => {
        let url = '/'
        if (typeof path === 'function') {
            url = path(queryParams)
        } else if (path) {
            url = path as string
        }
        if (url === window.location.origin) {
            window.location.href = url
        } else {
            history.push(url)
        }
    }, [history])

    const makeButton = ((path: string | ((params: URLSearchParams) => string), txt: string, fill: boolean) => {
        return (
            <Button
                filled={fill}
                size='large'
                onClick={async () => {
                    handleButtonClick(path)
                }}
            >
                {txt}
            </Button>
        )
    })

    return (
        <div className='ErrorPage'>
            <div>
                <div className='title'>
                    <FormattedMessage
                        id='error.page.title'
                        defaultMessage={'Sorry, something went wrong'}
                    />
                </div>
                <div className='subtitle'>
                    {errorDef.title}
                </div>
                <ErrorIllustration/>
                <br/>
                {
                    (errorDef.button1Enabled ? makeButton(errorDef.button1Redirect, errorDef.button1Text, errorDef.button1Fill) : null)
                }
                {
                    (errorDef.button2Enabled ? makeButton(errorDef.button2Redirect, errorDef.button2Text, errorDef.button2Fill) : null)
                }
            </div>
        </div>
    )
}

export default React.memo(ErrorPage)
