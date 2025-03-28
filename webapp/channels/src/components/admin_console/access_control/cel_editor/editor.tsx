import React, { useState, useEffect } from 'react';
import { FormattedMessage } from 'react-intl';

import './editor.scss';

interface CELEditorProps {
    value: string;
    onChange: (value: string) => void;
    onValidate?: (isValid: boolean) => void;
    placeholder?: string;
    className?: string;
}

const CELEditor: React.FC<CELEditorProps> = ({
    value,
    onChange,
    onValidate,
    placeholder = 'user.properties.<attribute> is <value> or is any of <list>',
    className = '',
}) => {
    const [expression, setExpression] = useState(value);
    const [isValidating, setIsValidating] = useState(false);
    const [isValid, setIsValid] = useState(true);

    useEffect(() => {
        setExpression(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setExpression(newValue);
        onChange(newValue);
    };

    const validateSyntax = () => {
        setIsValidating(true);
        
        // This is a placeholder for actual validation logic
        // In a real implementation, you would call an API to validate the CEL expression
        setTimeout(() => {
            // Simulate validation - in reality, this would be an API call
            const valid = expression.trim().length > 0;
            setIsValid(valid);
            if (onValidate) {
                onValidate(valid);
            }
            setIsValidating(false);
        }, 500);
    };

    const testAccessRule = () => {
        // This would be implemented to test the access rule against sample data
        // For now, it's just a placeholder
        console.log('Testing access rule:', expression);
    };

    return (
        <div className={`cel-editor ${className}`}>
            <div className="cel-editor__container">
                <textarea
                    className="cel-editor__input"
                    value={expression}
                    onChange={handleChange}
                    placeholder={placeholder}
                    aria-label="CEL Expression Editor"
                />
            </div>
            
            <div className="cel-editor__footer">
                <div className="cel-editor__actions">
                    <button
                        className="cel-editor__validate-btn"
                        onClick={validateSyntax}
                        disabled={isValidating}
                    >
                        {isValidating ? (
                            <span className="cel-editor__loading">
                                <i className="fa fa-spinner fa-spin" />
                                <FormattedMessage
                                    id="admin.access_control.cel.validating"
                                    defaultMessage="Validating..."
                                />
                            </span>
                        ) : (
                            <FormattedMessage
                                id="admin.access_control.cel.validateSyntax"
                                defaultMessage="Validate syntax"
                            />
                        )}
                    </button>
                </div>
                
                <button
                    className="cel-editor__test-btn"
                    onClick={testAccessRule}
                    disabled={!isValid || isValidating}
                >
                    <i className="icon icon-lock-outline" />
                    <FormattedMessage
                        id="admin.access_control.cel.testAccessRule"
                        defaultMessage="Test access rule"
                    />
                </button>
            </div>
            
            <div className="cel-editor__help-text">
                <FormattedMessage
                    id="admin.access_control.cel.writeRules"
                    defaultMessage="Write rules like "
                />
                <code>user.&lt;attribute&gt; is &lt;value&gt;</code>
                <FormattedMessage
                    id="admin.access_control.cel.or"
                    defaultMessage=" or "
                />
                <code>is any of &lt;list&gt;</code>
                <FormattedMessage
                    id="admin.access_control.cel.useOperators"
                    defaultMessage=". Use "
                />
                <code>AND</code> / <code>OR</code>
                <FormattedMessage
                    id="admin.access_control.cel.forMultipleConditions"
                    defaultMessage=" for multiple conditions. Group conditions with "
                />
                <code>()</code>.
                <a href="#" className="cel-editor__learn-more">
                    <FormattedMessage
                        id="admin.access_control.cel.learnMore"
                        defaultMessage="Learn more about creating access expressions with examples."
                    />
                </a>
            </div>
        </div>
    );
};

export default CELEditor;