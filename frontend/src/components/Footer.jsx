import { Fragment } from 'react';

const LINKS = [['about', 'About'], ['terms', 'Terms of Service'], ['privacy', 'Privacy Policy']];

const Sep = () => <span aria-hidden="true" className="h-3 w-px bg-white/15" />;

export default function Footer({ onNavigate }) {
    return (
        <footer className="relative border-t border-white/[0.07] bg-ink/80 backdrop-blur-(--nav-blur)">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-6 text-sm text-white/45">
                <span>© 2026 Boxi Inc. All rights reserved.</span>
                {LINKS.map(([id, label]) => (
                    <Fragment key={id}>
                        <Sep />
                        <button onClick={() => onNavigate(id)} className="rounded transition hover:text-white focus-visible:text-white focus-visible:outline-none">{label}</button>
                    </Fragment>
                ))}
            </div>
        </footer>
    );
}
