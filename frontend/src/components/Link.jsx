import { navigate } from '../hooks/useUrl';

// <a> that navigates without reloading (ctrl/cmd-click and middle click still open a new tab).
export default function Link({ href, children, onClick, ...p }) {
    const click = (e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(href);
    };
    return <a href={href} onClick={click} {...p}>{children}</a>;
}
