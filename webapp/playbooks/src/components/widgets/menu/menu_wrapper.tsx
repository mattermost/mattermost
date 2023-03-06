import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import styled from 'styled-components';

type Props = {
    children?: React.ReactNode;
    stopPropagationOnToggle?: boolean;
    className?: string
    disabled?: boolean
    isOpen?: boolean
    onToggle?: (open: boolean) => void
    label?: string
}

const MenuWrapper = (props: Props) => {
    const node = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(Boolean(props.isOpen));

    if (!Array.isArray(props.children) || props.children.length !== 2) {
        throw new Error('MenuWrapper needs exactly 2 children');
    }

    const close = useCallback((): void => {
        if (open) {
            setOpen(false);
            if (props.onToggle) {
                props.onToggle(false);
            }
        }
    }, [props.onToggle, open]);

    const closeOnBlur = useCallback((e: Event) => {
        if (e.target && node.current?.contains(e.target as Node)) {
            return;
        }

        close();
    }, [close]);

    const keyboardClose = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            close();
        }

        if (e.key === 'Tab') {
            closeOnBlur(e);
        }
    }, [close, closeOnBlur]);

    const toggle = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
        if (props.disabled) {
            return;
        }

        /**
         * This is only here so that we can toggle the menus in the sidebar, because the default behavior of the mobile
         * version (ie the one that uses a modal) needs propagation to close the modal after selecting something
         * We need to refactor this so that the modal is explicitly closed on toggle, but for now I am aiming to preserve the existing logic
         * so as to not break other things
        **/
        if (props.stopPropagationOnToggle) {
            e.preventDefault();
            e.stopPropagation();
        }
        setOpen(!open);
        if (props.onToggle) {
            props.onToggle(!open);
        }
    }, [props.onToggle, open, props.disabled]);

    useEffect(() => {
        document.addEventListener('click', closeOnBlur, true);
        document.addEventListener('keyup', keyboardClose, true);
        return () => {
            document.removeEventListener('click', closeOnBlur, true);
            document.removeEventListener('keyup', keyboardClose, true);
        };
    }, [close, closeOnBlur, keyboardClose]);

    const {children} = props;
    let className = props.className || '';
    if (props.disabled) {
        className += ' disabled';
    }

    return (
        <MenuWrapperComponent
            role='button'
            aria-label={props.label || 'menuwrapper'}
            className={className}
            onClick={toggle}
            ref={node}
        >
            {children ? Object.values(children)[0] : null}
            {children && !props.disabled && open ? Object.values(children)[1] : null}
        </MenuWrapperComponent>
    );
};

export default React.memo(MenuWrapper);

const MenuWrapperComponent = styled.div`
    position: relative;

    &.disabled {
        cursor: default;
    }

    *:first-child { 
        /* stylelint-disable property-no-vendor-prefix*/
        -webkit-user-select: text; /* Chrome all / Safari all */
        -moz-user-select: text; /* Firefox all */
        -ms-user-select: text; /* IE 10+ */
        user-select: text;
        /* stylelint-enable property-no-vendor-prefix*/
    }
`;
