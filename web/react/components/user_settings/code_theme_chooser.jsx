// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Constants = require('../../utils/constants.jsx');

export default class CodeThemeChooser extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        const theme = this.props.theme;

        const premadeThemes = [];
        for (const k in Constants.CODE_THEMES) {
            if (Constants.CODE_THEMES.hasOwnProperty(k)) {
                let activeClass = '';
                if (k === theme.codeTheme) {
                    activeClass = 'active';
                }

                premadeThemes.push(
                    <div
                        className='col-xs-6 col-sm-3 premade-themes'
                        key={'premade-theme-key' + k}
                    >
                        <div
                            className={activeClass}
                            onClick={() => this.props.updateTheme(k)}
                        >
                            <label>
                                <img
                                    className='img-responsive'
                                    src={'/static/images/themes/code_themes/' + k + '.png'}
                                />
                                <div className='theme-label'>{Constants.CODE_THEMES[k]}</div>
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

CodeThemeChooser.propTypes = {
    theme: React.PropTypes.object.isRequired,
    updateTheme: React.PropTypes.func.isRequired
};
