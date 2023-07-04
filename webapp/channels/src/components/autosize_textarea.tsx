// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent, FormEvent, CSSProperties} from 'react';
import styled from 'styled-components';

type Props = {
    id?: string;
    className?: string;
    disabled?: boolean;
    value?: string;
    defaultValue?: string;
    onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    onHeightChange?: (height: number, maxHeight: number, rows: number) => void;
    onWidthChange?: (width: number) => void;
    onInput?: (e: FormEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    style?: CSSProperties;
    forwardedRef?: ((instance: HTMLTextAreaElement | null) => void) | React.MutableRefObject<HTMLTextAreaElement | null> | null;
}

export class AutosizeTextarea extends React.PureComponent<Props> {
    private height: number;

    private textarea?: HTMLTextAreaElement;
    private referenceRef: React.RefObject<HTMLDivElement>;
    private measuringRef: React.RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);

        this.height = 0;
        this.width = 0;

        this.referenceRef = React.createRef();
        this.measuringRef = React.createRef();
    }

    componentDidMount() {
        this.recalculateHeight();
        this.recalculateWidth();
    }

    componentDidUpdate() {
        this.recalculateHeight();
        this.recalculateWidth();
        // this.recalculatePadding();
    }

    private recalculateHeight = () => {
        if (!this.referenceRef.current || !this.textarea) {
            return;
        }

        const height = (this.referenceRef.current).scrollHeight;
        const textarea = this.textarea;

        if (height > 0 && height !== this.height) {
            const style = getComputedStyle(textarea);

            // Directly change the height to avoid circular rerenders
            textarea.style.height = `${height}px`;

            const maxHeight = pixelsToNumber(style.maxHeight);

            const heightMinusPadding = textarea.scrollHeight - pixelsToNumber(style.paddingTop) - pixelsToNumber(style.paddingBottom);
            const rows = Math.floor(heightMinusPadding / pixelsToNumber(style.lineHeight));

            this.props.onHeightChange?.(height, maxHeight, rows);

            this.height = height;
        }
    };

    // private recalculatePadding = () => {
    //     if (!this.referenceRef.current || !this.textarea) {
    //         return;
    //     }

    //     const textarea = this.textarea;
    //     const {paddingRight} = getComputedStyle(textarea);

    //     if (paddingRight && paddingRight !== this.referenceRef.current.style.paddingRight) {
    //         this.referenceRef.current.style.paddingRight = paddingRight;
    //     }
    // };

    private recalculateWidth = () => {
        if (!this.measuringRef) {
            return;
        }

        const width = this.measuringRef.current?.offsetWidth || -1;
        if (width >= 0) {
            window.requestAnimationFrame(() => {
                this.props.onWidthChange?.(width);
            });
        }
    };

    private setTextareaRef = (textarea: HTMLTextAreaElement) => {
        if (this.props.forwardedRef) {
            if (typeof this.props.forwardedRef === 'function') {
                this.props.forwardedRef(textarea);
            } else {
                this.props.forwardedRef.current = textarea;
            }
        }

        this.textarea = textarea;
    };

    render() {
        const props = {...this.props};

        Reflect.deleteProperty(props, 'onHeightChange');
        Reflect.deleteProperty(props, 'onWidthChange');
        Reflect.deleteProperty(props, 'providers');
        Reflect.deleteProperty(props, 'channelId');
        Reflect.deleteProperty(props, 'forwardedRef');

        const {
            value,
            defaultValue,
            placeholder,
            disabled,
            onChange,
            onInput,

            // TODO: The provided `id` is sometimes hard-coded and used to interface with the
            // component, e.g. `post_textbox`, so it can't be changed. This would ideally be
            // abstracted to avoid passing in an `id` prop at all, but we intentionally maintain
            // the old behaviour to address ABC-213.
            id = 'autosize_textarea',
            ...otherProps
        } = props;

        const heightProps = {
            rows: 0,
            height: 0,
        };

        if (this.height <= 0) {
            // Set an initial number of rows so that the textarea doesn't appear too large when its first rendered
            heightProps.rows = 1;
        } else {
            heightProps.height = this.height;
        }

        let textareaPlaceholder = null;
        const placeholderAriaLabel = placeholder ? placeholder.toLowerCase() : '';
        if (!this.props.value && !this.props.defaultValue) {
            textareaPlaceholder = (
                <div
                    {...otherProps as any}
                    id={`${id}_placeholder`}
                    data-testid={`${id}_placeholder`}
                    style={styles.placeholder}
                >
                    {placeholder}
                </div>
            );
        }

        return (
            <div>
                {textareaPlaceholder}
                <textarea
                    ref={this.setTextareaRef}
                    data-testid={id}
                    id={id}
                    {...heightProps}
                    {...otherProps}
                    role='textbox'
                    aria-label={placeholderAriaLabel}
                    dir='auto'
                    disabled={disabled}
                    onChange={onChange}
                    onInput={onInput}
                    value={value}
                    defaultValue={defaultValue}
                />
                <div style={styles.container}>
                    <Reference
                        ref={this.referenceRef}
                        id={id + '-reference'}
                        style={styles.reference}
                        dir='auto'
                        disabled={true}
                        {...otherProps}
                        aria-hidden={true}
                    >
                        {value || defaultValue}
                    </Reference>
                    <div
                        ref={this.measuringRef}
                        id={id + '-measuring'}
                        style={styles.measuring}
                    >
                        {value || defaultValue}
                    </div>
                </div>
            </div>
        );
    }
}

function pixelsToNumber(numPixels?: string): number {
    return parseInt(numPixels || '0', 10);
}

const Reference = styled.div`
    height: auto;
    width: 100%;

    border: 1px solid cyan;
    background-color: rgba(192, 128, 128, 0.5);
`;

const styles: { [Key: string]: CSSProperties} = {
    container: {height: 0, overflow: 'hidden'}, //, position: 'fixed', top: 0, left: 0, zIndex: 69420},
    reference: {height: 'auto', width: '100%', border: '1px solid cyan', backgroundColor: 'rgba(192, 128, 128, 0.5)'},
    placeholder: {overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.5, pointerEvents: 'none', position: 'absolute', whiteSpace: 'nowrap', background: 'none', borderColor: 'transparent'},
    measuring: {width: 'auto', display: 'inline-block', border: '1px solid pink', backgroundColor: 'rgba(128, 192, 128, 0.5)'},
};

const forwarded = React.forwardRef<HTMLTextAreaElement>((props, ref) => (
    <AutosizeTextarea
        forwardedRef={ref}
        {...props}
    />
));

forwarded.displayName = 'AutosizeTextarea';

export default forwarded;
