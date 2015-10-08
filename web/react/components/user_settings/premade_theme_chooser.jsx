// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Utils = require('../../utils/utils.jsx');
var Constants = require('../../utils/constants.jsx');

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
                                    src={'/static/images/themes/' + premadeTheme.type.toLowerCase() + '.png'}
                                />
                                <div className='theme-label'>{Utils.toTitleCase(premadeTheme.type)}</div>
                            </label>
                        </div>
                    </div>
                );
            }
        }

        return (
            <div className='row'>
                {premadeThemes}
            </div>
        );
    }
}

PremadeThemeChooser.propTypes = {
    theme: React.PropTypes.object.isRequired,
    updateTheme: React.PropTypes.func.isRequired
};
