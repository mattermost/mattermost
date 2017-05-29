// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import PropTypes from 'prop-types';

import React from 'react';

export default class PremadeThemeChooser extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        const theme = this.props.theme;

        const premadeThemes = [];
        for (const k in Constants.THEMES) {
            if (Constants.THEMES.hasOwnProperty(k)) {
                const premadeTheme = $.extend(true, {}, Constants.THEMES[k]);

                let activeClass = '';
                if (premadeTheme.type === theme.type) {
                    activeClass = 'active';
                }

                premadeThemes.push(
                    <div
                        className='col-xs-6 col-sm-3 premade-themes'
                        key={'premade-theme-key' + k}
                    >
                        <div
                            className={activeClass}
                            onClick={() => this.props.updateTheme(premadeTheme)}
                        >
                            <label>
                                <img
                                    className='img-responsive'
                                    src={premadeTheme.image}
                                />
                                <div className='theme-label'>{Utils.toTitleCase(premadeTheme.type)}</div>
                            </label>
                        </div>
                    </div>
                );
            }
        }

        return (
            <div className='row appearance-section'>
                <div className='clearfix'>
                    {premadeThemes}
                </div>
            </div>
        );
    }
}

PremadeThemeChooser.propTypes = {
    theme: PropTypes.object.isRequired,
    updateTheme: PropTypes.func.isRequired
};
