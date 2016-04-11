// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export class RateSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            enableRateLimiter: props.config.RateLimitSettings.EnableRateLimiter,
            perSec: props.config.RateLimitSettings.PerSec,
            memoryStoreSize: props.config.RateLimitSettings.MemoryStoreSize,
            varyByRemoteAddr: props.config.RateLimitSettings.VaryByRemoteAddr,
            varyByHeader: props.config.RateLimitSettings.VaryByHeader
        });
    }

    getConfigFromState(config) {
        config.RateLimitSettings.EnableRateLimiter = this.state.enableRateLimiter;
        config.RateLimitSettings.PerSec = this.parseIntNonZero(this.state.perSec);
        config.RateLimitSettings.MemoryStoreSize = this.parseIntNonZero(this.state.memoryStoreSize);
        config.RateLimitSettings.VaryByRemoteAddr = this.state.varyByRemoteAddr;
        config.RateLimitSettings.VaryByHeader = this.state.varyByHeader;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.rate.title'
                    defaultMessage='Rate Limit Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <RateSettings
                enableRateLimiter={this.state.enableRateLimiter}
                perSec={this.state.perSec}
                memoryStoreSize={this.state.memoryStoreSize}
                varyByRemoteAddr={this.state.varyByRemoteAddr}
                varyByHeader={this.state.varyByHeader}
                onChange={this.handleChange}
            />
        );
    }
}

export class RateSettings extends React.Component {
    static get propTypes() {
        return {
            enableRateLimiter: React.PropTypes.bool.isRequired,
            perSec: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            memoryStoreSize: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            varyByRemoteAddr: React.PropTypes.bool.isRequired,
            varyByHeader: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        return (
            <SettingsGroup>
                <div className='banner'>
                    <div className='banner__content'>
                        <FormattedMessage
                            id='admin.rate.noteDescription'
                            defaultMessage='Changing properties in this section will require a server restart before taking effect.'
                        />
                    </div>
                </div>
<<<<<<< HEAD

                <h3>
                    <FormattedMessage
                        id='admin.rate.title'
                        defaultMessage='Rate Limit Settings'
                    />
                </h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableRateLimiter'
                        >
                            <FormattedMessage
                                id='admin.rate.enableLimiterTitle'
                                defaultMessage='Enable Rate Limiter: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableRateLimiter'
                                    value='true'
                                    ref='EnableRateLimiter'
                                    defaultChecked={this.props.config.RateLimitSettings.EnableRateLimiter}
                                    onChange={this.handleChange.bind(this, 'EnableRateLimiterTrue')}
                                />
                                <FormattedMessage
                                    id='admin.rate.true'
                                    defaultMessage='true'
                                />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableRateLimiter'
                                    value='false'
                                    defaultChecked={!this.props.config.RateLimitSettings.EnableRateLimiter}
                                    onChange={this.handleChange.bind(this, 'EnableRateLimiterFalse')}
                                />
                                <FormattedMessage
                                    id='admin.rate.false'
                                    defaultMessage='false'
                                />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.rate.enableLimiterDescription'
                                    defaultMessage='When true, APIs are throttled at rates specified below.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PerSec'
                        >
                            <FormattedMessage
                                id='admin.rate.queriesTitle'
                                defaultMessage='Number Of Queries Per Second:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PerSec'
                                ref='PerSec'
                                placeholder={formatMessage(holders.queriesExample)}
                                defaultValue={this.props.config.RateLimitSettings.PerSec}
                                onChange={this.handleChange}
                                disabled={!this.state.EnableRateLimiter}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.rate.queriesDescription'
                                    defaultMessage='Throttles API at this number of requests per second.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='MemoryStoreSize'
                        >
                            <FormattedMessage
                                id='admin.rate.memoryTitle'
                                defaultMessage='Memory Store Size:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='MemoryStoreSize'
                                ref='MemoryStoreSize'
                                placeholder={formatMessage(holders.memoryExample)}
                                defaultValue={this.props.config.RateLimitSettings.MemoryStoreSize}
                                onChange={this.handleChange}
                                disabled={!this.state.EnableRateLimiter}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.rate.memoryDescription'
                                    defaultMessage='Maximum number of users sessions connected to the system as determined by "Vary By Remote Address" and "Vary By Header" settings below.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='VaryByRemoteAddr'
                        >
                            <FormattedMessage
                                id='admin.rate.remoteTitle'
                                defaultMessage='Vary By Remote Address: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='VaryByRemoteAddr'
                                    value='true'
                                    ref='VaryByRemoteAddr'
                                    defaultChecked={this.props.config.RateLimitSettings.VaryByRemoteAddr}
                                    onChange={this.handleChange.bind(this, 'VaryByRemoteAddrTrue')}
                                    disabled={!this.state.EnableRateLimiter}
                                />
                                <FormattedMessage
                                    id='admin.rate.true'
                                    defaultMessage='true'
                                />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='VaryByRemoteAddr'
                                    value='false'
                                    defaultChecked={!this.props.config.RateLimitSettings.VaryByRemoteAddr}
                                    onChange={this.handleChange.bind(this, 'VaryByRemoteAddrFalse')}
                                    disabled={!this.state.EnableRateLimiter}
                                />
                                <FormattedMessage
                                    id='admin.rate.false'
                                    defaultMessage='false'
                                />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.rate.remoteDescription'
                                    defaultMessage='When true, rate limit API access by IP address.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='VaryByHeader'
                        >
                            <FormattedMessage
                                id='admin.rate.httpHeaderTitle'
                                defaultMessage='Vary By HTTP Header:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='VaryByHeader'
                                ref='VaryByHeader'
                                placeholder={formatMessage(holders.httpHeaderExample)}
                                defaultValue={this.props.config.RateLimitSettings.VaryByHeader}
                                onChange={this.handleChange}
                                disabled={!this.state.EnableRateLimiter || this.state.VaryByRemoteAddr}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.rate.httpHeaderDescription'
                                    defaultMessage='When filled in, vary rate limiting by HTTP header field specified (e.g. when configuring NGINX set to "X-Real-IP", when configuring AmazonELB set to "X-Forwarded-For").'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <div className='col-sm-12'>
                            {serverError}
                            <button
                                disabled={!this.state.saveNeeded}
                                type='submit'
                                className={saveClass}
                                onClick={this.handleSubmit}
                                id='save-button'
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(holders.saving)}
                            >
                                <FormattedMessage
                                    id='admin.rate.save'
                                    defaultMessage='Save'
                                />
                            </button>
                        </div>
                    </div>

                </form>
            </div>
        );
    }
}

RateSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(RateSettings);
=======
                <BooleanSetting
                    id='enableRateLimiter'
                    label={
                        <FormattedMessage
                            id='admin.rate.enableLimiterTitle'
                            defaultMessage='Enable Rate Limiter: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.rate.enableLimiterDescription'
                            defaultMessage='When true, APIs are throttled at rates specified below.'
                        />
                    }
                    value={this.props.enableRateLimiter}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='perSec'
                    label={
                        <FormattedMessage
                            id='admin.rate.queriesTitle'
                            defaultMessage='Number Of Queries Per Second:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.rate.queriesExample', 'Ex "10"')}
                    helpText={
                        <FormattedMessage
                            id='admin.rate.queriesDescription'
                            defaultMessage='Throttles API at this number of requests per second.'
                        />
                    }
                    value={this.props.perSec}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableRateLimiter}
                />
                <TextSetting
                    id='memoryStoreSize'
                    label={
                        <FormattedMessage
                            id='admin.rate.memoryTitle'
                            defaultMessage='Memory Store Size:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.rate.memoryExample', 'Ex "10000"')}
                    helpText={
                        <FormattedMessage
                            id='admin.rate.memoryDescription'
                            defaultMessage='Maximum number of users sessions connected to the system as determined by "Vary By Remote Address" and "Vary By Header" settings below.'
                        />
                    }
                    value={this.props.memoryStoreSize}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableRateLimiter}
                />
                <BooleanSetting
                    id='varyByRemoteAddr'
                    label={
                        <FormattedMessage
                            id='admin.rate.remoteTitle'
                            defaultMessage='Vary By Remote Address: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.rate.remoteDescription'
                            defaultMessage='When true, rate limit API access by IP address.'
                        />
                    }
                    value={this.props.varyByRemoteAddr}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableRateLimiter}
                />
                <TextSetting
                    id='varyByHeader'
                    label={
                        <FormattedMessage
                            id='admin.rate.httpHeaderTitle'
                            defaultMessage='Vary By HTTP Header:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.rate.httpHeaderExample', 'Ex "X-Real-IP", "X-Forwarded-For"')}
                    helpText={
                        <FormattedMessage
                            id='admin.rate.httpHeaderDescription'
                            defaultMessage='When filled in, vary rate limiting by HTTP header field specified (e.g. when configuring NGINX set to "X-Real-IP", when configuring AmazonELB set to "X-Forwarded-For").'
                        />
                    }
                    value={this.props.varyByHeader}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableRateLimiter || this.props.varyByRemoteAddr}
                />
            </SettingsGroup>
        );
    }
}
>>>>>>> 6d02983... Reorganized system console
