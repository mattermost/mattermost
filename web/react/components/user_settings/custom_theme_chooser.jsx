// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Constants = require('../../utils/constants.jsx');

export default class CustomThemeChooser extends React.Component {
    constructor(props) {
        super(props);

        this.onPickerChange = this.onPickerChange.bind(this);
        this.onInputChange = this.onInputChange.bind(this);
        this.pasteBoxChange = this.pasteBoxChange.bind(this);

        this.state = {};
    }
    componentDidMount() {
        $('.color-picker').colorpicker({
            format: 'hex'
        });
        $('.color-picker').on('changeColor', this.onPickerChange);
    }
    onPickerChange(e) {
        const theme = this.props.theme;
        theme[e.target.id] = e.color.toHex();
        theme.type = 'custom';
        this.props.updateTheme(theme);
    }
    onInputChange(e) {
        const theme = this.props.theme;
        theme[e.target.parentNode.id] = e.target.value;
        theme.type = 'custom';
        this.props.updateTheme(theme);
    }
    pasteBoxChange(e) {
        const text = e.target.value;

        if (text.length === 0) {
            return;
        }

        const colors = text.split(',');

        const theme = {type: 'custom'};
        let index = 0;
        Constants.THEME_ELEMENTS.forEach((element) => {
            if (index < colors.length - 1) {
                theme[element.id] = colors[index];
            }
            index++;
        });
        theme.codeTheme = colors[colors.length - 1];

        this.props.updateTheme(theme);
    }
    render() {
        const theme = this.props.theme;

        const elements = [];
        let colors = '';
        Constants.THEME_ELEMENTS.forEach((element, index) => {
            if (element.id === 'codeTheme') {
                const codeThemeOptions = [];

                element.themes.forEach((codeTheme, codeThemeIndex) => {
                    codeThemeOptions.push(
                        <option
                            key={'code-theme-key' + codeThemeIndex}
                            value={codeTheme.id}
                        >
                            {codeTheme.uiName}
                        </option>
                    );
                });

                elements.push(
                    <div
                        className='col-sm-4 form-group'
                        key={'custom-theme-key' + index}
                    >
                        <label className='custom-label'>{element.uiName}</label>
                        <div
                            className='input-group theme-group dropdown'
                            id={element.id}
                        >
                            <select
                                className='form-control'
                                type='text'
                                defaultValue={theme[element.id]}
                                onChange={this.onInputChange}
                            >
                                {codeThemeOptions}
                            </select>
                            <span className='input-group-addon'>
                                <img
                                    src={'/static/images/themes/code_themes/' + theme[element.id] + '.png'}
                                />
                            </span>
                        </div>
                    </div>
                );
            } else {
                elements.push(
                    <div
                        className='col-sm-4 form-group'
                        key={'custom-theme-key' + index}
                    >
                        <label className='custom-label'>{element.uiName}</label>
                        <div
                            className='input-group color-picker'
                            id={element.id}
                        >
                            <input
                                className='form-control'
                                type='text'
                                defaultValue={theme[element.id]}
                                onChange={this.onInputChange}
                            />
                            <span className='input-group-addon'><i></i></span>
                        </div>
                    </div>
                );

                colors += theme[element.id] + ',';
            }
        });

        colors += theme.codeTheme;

        const pasteBox = (
            <div className='col-sm-12'>
                <label className='custom-label'>
                    {'Copy and paste to share theme colors:'}
                </label>
                <input
                    type='text'
                    className='form-control'
                    value={colors}
                    onChange={this.pasteBoxChange}
                />
            </div>
        );

        return (
            <div>
                <div className='row form-group'>
                    {elements}
                </div>
                <div className='row'>
                    {pasteBox}
                </div>
            </div>
        );
    }
}

CustomThemeChooser.propTypes = {
    theme: React.PropTypes.object.isRequired,
    updateTheme: React.PropTypes.func.isRequired
};
