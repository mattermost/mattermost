// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class RateSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.RateLimitSettings.Enable = this.state.enable;
        config.RateLimitSettings.PerSec = this.parseIntNonZero(this.state.perSec);
        config.RateLimitSettings.MaxBurst = this.parseIntNonZero(this.state.maxBurst);
        config.RateLimitSettings.MemoryStoreSize = this.parseIntNonZero(this.state.memoryStoreSize);
        config.RateLimitSettings.VaryByRemoteAddr = this.state.varyByRemoteAddr;
        config.RateLimitSettings.VaryByHeader = this.state.varyByHeader;

        return config;
    }

    getStateFromConfig(config) {
        return {
            enable: config.RateLimitSettings.Enable,
            perSec: config.RateLimitSettings.PerSec,
            maxBurst: config.RateLimitSettings.MaxBurst,
            memoryStoreSize: config.RateLimitSettings.MemoryStoreSize,
            varyByRemoteAddr: config.RateLimitSettings.VaryByRemoteAddr,
            varyByHeader: config.RateLimitSettings.VaryByHeader
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.rate.title'
                defaultMessage='Rate Limit Settings'
            />
        );
    }

    renderSettings() {
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
                <BooleanSetting
                    id='enable'
                    label={
                        <FormattedMessage
                            id='admin.rate.enableLimiterTitle'
                            defaultMessage='Enable Rate Limiting: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.rate.enableLimiterDescription'
                            defaultMessage='When true, APIs are throttled at rates specified below.'
                        />
                    }
                    value={this.state.enable}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='perSec'
                    label={
                        <FormattedMessage
                            id='admin.rate.queriesTitle'
                            defaultMessage='Maximum Queries per Second:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.rate.queriesExample', 'Ex "10"')}
                    helpText={
                        <FormattedMessage
                            id='admin.rate.queriesDescription'
                            defaultMessage='Throttles API at this number of requests per second.'
                        />
                    }
                    value={this.state.perSec}
                    onChange={this.handleChange}
                    disabled={!this.state.enable}
                />
                <TextSetting
                    id='maxBurst'
                    label={
                        <FormattedMessage
                            id='admin.rate.maxBurst'
                            defaultMessage='Maximum Burst Size:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.rate.maxBurstExample', 'Ex "100"')}
                    helpText={
                        <FormattedMessage
                            id='admin.rate.maxBurstDescription'
                            defaultMessage='Maximum number of requests allowed beyond the per second query limit.'
                        />
                    }
                    value={this.state.maxBurst}
                    onChange={this.handleChange}
                    disabled={!this.state.enable}
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
                            defaultMessage='Maximum number of users sessions connected to the system as determined by "Vary rate limit by remote address" and "Vary rate limit by HTTP header".'
                        />
                    }
                    value={this.state.memoryStoreSize}
                    onChange={this.handleChange}
                    disabled={!this.state.enable}
                />
                <BooleanSetting
                    id='varyByRemoteAddr'
                    label={
                        <FormattedMessage
                            id='admin.rate.remoteTitle'
                            defaultMessage='Vary rate limit by remote address: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.rate.remoteDescription'
                            defaultMessage='When true, rate limit API access by IP address.'
                        />
                    }
                    value={this.state.varyByRemoteAddr}
                    onChange={this.handleChange}
                    disabled={!this.state.enable}
                />
                <TextSetting
                    id='varyByHeader'
                    label={
                        <FormattedMessage
                            id='admin.rate.httpHeaderTitle'
                            defaultMessage='Vary rate limit by HTTP header:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.rate.httpHeaderExample', 'Ex "X-Real-IP", "X-Forwarded-For"')}
                    helpText={
                        <FormattedMessage
                            id='admin.rate.httpHeaderDescription'
                            defaultMessage='When filled in, vary rate limiting by HTTP header field specified (e.g. when configuring NGINX set to "X-Real-IP", when configuring AmazonELB set to "X-Forwarded-For").'
                        />
                    }
                    value={this.state.varyByHeader}
                    onChange={this.handleChange}
                    disabled={!this.state.enable || this.state.varyByRemoteAddr}
                />
            </SettingsGroup>
        );
    }
}
