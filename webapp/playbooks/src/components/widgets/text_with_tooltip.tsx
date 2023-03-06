import React, {
    ComponentProps,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {debounce} from 'debounce';

import Tooltip from './tooltip';

interface Props {
    id: string;
    text: string;
    className?: string;
    placement?: ComponentProps<typeof Tooltip>['placement'];
}

const TextWithTooltip = (props: Props) => {
    const ref = useRef<HTMLAnchorElement|null>(null);
    const [showTooltip, setShowTooltip] = useState(false);

    const resizeListener = useMemo(() => debounce(() => {
        if (ref?.current && ref?.current?.offsetWidth < ref?.current?.scrollWidth) {
            setShowTooltip(true);
        } else {
            setShowTooltip(false);
        }
    }, 300), []);

    useEffect(() => {
        window.addEventListener('resize', resizeListener);

        // clean up function
        return () => {
            window.removeEventListener('resize', resizeListener);
        };
    }, []);

    useEffect(() => {
        resizeListener();
    });

    const setRef = useCallback((node) => {
        ref.current = node;
        resizeListener();
    }, []);

    const text = (
        <span
            ref={setRef}
            className={props.className}
        >
            {props.text}
        </span>
    );

    if (showTooltip) {
        return (
            <Tooltip
                id={`${props.id}_name`}
                placement={props.placement}
                content={props.text}
            >
                {text}
            </Tooltip>
        );
    }

    return text;
};

export default TextWithTooltip;
