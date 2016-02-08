// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from '../../utils/constants.jsx';
import * as GlobalActions from '../../action_creators/global_actions.jsx';
import SuggestionStore from '../../stores/suggestion_store.jsx';
import * as Utils from '../../utils/utils.jsx';

const KeyCodes = Constants.KeyCodes;

export default class SuggestionBox extends React.Component {
    constructor(props) {
        super(props);

        this.handleDocumentClick = this.handleDocumentClick.bind(this);

        this.handleChange = this.handleChange.bind(this);
        this.handleCompleteWord = this.handleCompleteWord.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handlePretextChanged = this.handlePretextChanged.bind(this);

        this.suggestionId = Utils.generateId();
    }

    componentDidMount() {
        SuggestionStore.registerSuggestionBox(this.suggestionId);
        $(document).on('click', this.handleDocumentClick);

        SuggestionStore.addCompleteWordListener(this.suggestionId, this.handleCompleteWord);
        SuggestionStore.addPretextChangedListener(this.suggestionId, this.handlePretextChanged);
    }

    componentWillUnmount() {
        SuggestionStore.removeCompleteWordListener(this.suggestionId, this.handleCompleteWord);
        SuggestionStore.removePretextChangedListener(this.suggestionId, this.handlePretextChanged);

        SuggestionStore.unregisterSuggestionBox(this.suggestionId);
        $(document).off('click', this.handleDocumentClick);
    }

    getTextbox() {
        // this is to support old code that looks at the input/textarea DOM nodes
        return ReactDOM.findDOMNode(this.refs.textbox);
    }

    handleDocumentClick(e) {
        const container = $(ReactDOM.findDOMNode(this));
        if (!(container.is(e.target) || container.has(e.target).length > 0)) {
            // we can't just use blur for this because it fires and hides the children before
            // their click handlers can be called
            GlobalActions.emitClearSuggestions(this.suggestionId);
        }
    }

    handleChange(e) {
        const textbox = ReactDOM.findDOMNode(this.refs.textbox);
        const caret = Utils.getCaretPosition(textbox);
        const pretext = textbox.value.substring(0, caret);

        GlobalActions.emitSuggestionPretextChanged(this.suggestionId, pretext);

        if (this.props.onUserInput) {
            this.props.onUserInput(textbox.value);
        }

        if (this.props.onChange) {
            this.props.onChange(e);
        }
    }

    handleCompleteWord(term) {
        const textbox = ReactDOM.findDOMNode(this.refs.textbox);
        const caret = Utils.getCaretPosition(textbox);

        const text = this.props.value;
        const prefix = text.substring(0, caret - SuggestionStore.getMatchedPretext(this.suggestionId).length);
        const suffix = text.substring(caret);

        if (this.props.onUserInput) {
            this.props.onUserInput(prefix + term + ' ' + suffix);
        }

        // set the caret position after the next rendering
        window.requestAnimationFrame(() => {
            Utils.setCaretPosition(textbox, prefix.length + term.length + 1);
        });
    }

    handleKeyDown(e) {
        if (SuggestionStore.hasSuggestions(this.suggestionId)) {
            if (e.which === KeyCodes.UP) {
                GlobalActions.emitSelectPreviousSuggestion(this.suggestionId);
                e.preventDefault();
            } else if (e.which === KeyCodes.DOWN) {
                GlobalActions.emitSelectNextSuggestion(this.suggestionId);
                e.preventDefault();
            } else if (e.which === KeyCodes.ENTER || e.which === KeyCodes.TAB) {
                GlobalActions.emitCompleteWordSuggestion(this.suggestionId);
                e.preventDefault();
            } else if (this.props.onKeyDown) {
                this.props.onKeyDown(e);
            }
        } else if (this.props.onKeyDown) {
            this.props.onKeyDown(e);
        }
    }

    handlePretextChanged(pretext) {
        for (const provider of this.props.providers) {
            provider.handlePretextChanged(this.suggestionId, pretext);
        }
    }

    render() {
        const newProps = Object.assign({}, this.props, {
            onChange: this.handleChange,
            onKeyDown: this.handleKeyDown
        });

        let textbox = null;
        if (this.props.type === 'input') {
            textbox = (
                <input
                    ref='textbox'
                    type='text'
                    {...newProps}
                />
            );
        } else if (this.props.type === 'textarea') {
            textbox = (
                <textarea
                    ref='textbox'
                    {...newProps}
                />
            );
        }

        const SuggestionListComponent = this.props.listComponent;

        return (
            <div>
                {textbox}
                <SuggestionListComponent suggestionId={this.suggestionId}/>
            </div>
        );
    }
}

SuggestionBox.defaultProps = {
    type: 'input'
};

SuggestionBox.propTypes = {
    listComponent: React.PropTypes.func.isRequired,
    type: React.PropTypes.oneOf(['input', 'textarea']).isRequired,
    value: React.PropTypes.string.isRequired,
    onUserInput: React.PropTypes.func,
    providers: React.PropTypes.arrayOf(React.PropTypes.object),

    // explicitly name any input event handlers we override and need to manually call
    onChange: React.PropTypes.func,
    onKeyDown: React.PropTypes.func
};
