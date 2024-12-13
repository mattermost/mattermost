// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';
import type {IntlShape} from 'react-intl';

import {Constants} from 'utils/constants';
import * as Utils from 'utils/utils';

export type CustomProperty ={
    name: string;
    type: string;
}

export type Props = {
    // intl: IntlShape;
    userProperties: Record<string, string>;
    properties: Properties[];
}

// type State = {
// }

export default function UserSettingsCustomAttributes(props: Props) {
    const inputFields = props.properties.map((property) => {
        return (
            <div
                key='positionSetting'
                className='form-group'
            >
                <label className='col-sm-5 control-label'>{property.name}</label>
                <div className='col-sm-7'>
                    <input
                        id='position'
                        autoFocus={true}
                        className='form-control'
                        type='text'
                        // onChange={this.updatePosition}
                        value={props.userProperties[property.name]}
                        maxLength={Constants.MAX_POSITION_LENGTH}
                        autoCapitalize='off'
                        onFocus={Utils.moveCursorToEnd}
                        aria-label={property.name}
                    />
                </div>
            </div>
        );
    });

    return (
        <div>
            {inputFields}
        </div>
    );
}
