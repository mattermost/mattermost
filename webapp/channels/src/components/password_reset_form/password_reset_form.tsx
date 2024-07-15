// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useCallback, memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useLocation, useHistory} from 'react-router-dom';

import {resetUserPassword} from 'mattermost-redux/actions/users';
import {getConfig, getPasswordConfig} from 'mattermost-redux/selectors/entities/general';

import WomanWithLockSvg from 'components/common/svg_images_components/woman_with_lock_svg';
import BrandedButton from 'components/custom_branding/branded_button';
import BrandedInput from 'components/custom_branding/branded_input';
import Input, {SIZE} from 'components/widgets/inputs/input/input';

import Constants from 'utils/constants';
import {isValidPassword} from 'utils/password';

const PasswordResetForm = () => {
    const intl = useIntl();
    const history = useHistory();
    const location = useLocation();
    const config = useSelector(getConfig);
    const siteName = config.SiteName;
    const passwordConfig = useSelector(getPasswordConfig);
    const dispatch = useDispatch();
    const {error: passwordInfo} = isValidPassword('', passwordConfig, intl);

    const [error, setError] = useState<React.ReactNode>(null);
    const [password, setPassword] = useState<string>('');

    const handlePasswordReset = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        const token = (new URLSearchParams(location.search)).get('token');

        if (typeof token !== 'string') {
            throw new Error('token must be a string');
        }
        const {data, error} = await dispatch(resetUserPassword(token, password));
        if (data) {
            history.push('/login?extra=' + Constants.PASSWORD_CHANGE);
            setError(null);
        } else if (error) {
            setError(error.message);
        }
    }, [password, location.search]);

    const errorElement = error ? (
        <div className='form-group has-error'>
            <label className='control-label'>
                {error}
            </label>
        </div>
    ) : null;

    return (
        <div className='col-sm-12'>
            <div className='signup-team__container reset-password'>
                <WomanWithLockSvg/>
                <FormattedMessage
                    id='password_form.title'
                    tagName='h1'
                    defaultMessage='Create a new password'
                />
                <form onSubmit={handlePasswordReset}>
                    <p>
                        <FormattedMessage
                            id='password_form.enter'
                            defaultMessage='Enter a new password for your {siteName} account below.'
                            values={{siteName}}
                        />
                        <br/>
                        {passwordInfo as string}
                    </p>
                    <div className='input-line'>
                        <div className={classNames('form-group', {'has-error': error})}>
                            <BrandedInput>
                                <Input
                                    id='resetPasswordInput'
                                    data-testid='resetPasswordInput'
                                    type='password'
                                    className='form-control'
                                    name='password'
                                    placeholder={intl.formatMessage({
                                        id: 'password_form.pwd',
                                        defaultMessage: 'New password',
                                    })}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    inputSize={SIZE.LARGE}
                                    spellCheck='false'
                                    autoFocus={true}
                                />
                            </BrandedInput>
                        </div>

                        <BrandedButton>
                            <button
                                id='resetPasswordButton'
                                type='submit'
                                className='btn btn-primary'
                            >
                                <FormattedMessage
                                    id='password_form.change'
                                    defaultMessage='Save password'
                                />
                            </button>
                        </BrandedButton>
                    </div>
                    {errorElement}
                </form>
            </div>
        </div>
    );
};

export default memo(PasswordResetForm);
