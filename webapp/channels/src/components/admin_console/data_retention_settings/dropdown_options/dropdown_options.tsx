// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils';

export const FOREVER = 'FOREVER';
export const YEARS = 'YEARS';
export const DAYS = 'DAYS';
export const HOURS = 'HOURS';
export const keepForeverOption = () => ({value: FOREVER, label: <div><i className='icon icon-infinity option-icon'/><span className='option_forever'>{Utils.localizeMessage({id: 'admin.data_retention.form.keepForever', defaultMessage: 'Keep forever'})}</span></div>});
export const yearsOption = () => ({value: YEARS, label: <span className='option_years'>{Utils.localizeMessage({id: 'admin.data_retention.form.years', defaultMessage: 'Years'})}</span>});
export const daysOption = () => ({value: DAYS, label: <span className='option_days'>{Utils.localizeMessage({id: 'admin.data_retention.form.days', defaultMessage: 'Days'})}</span>});
export const hoursOption = () => ({value: HOURS, label: <span className='option_hours'>{Utils.localizeMessage({id: 'admin.data_retention.form.hours', defaultMessage: 'Hours'})}</span>});
