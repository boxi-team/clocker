// Role icon (same CommunityDragon SVGs and accent gradient used in the Home meta cards).
// Accepts backend roles ('top', 'mid', 'adc'...), UI labels ('Top', 'ADC'...) or Riot positions ('MIDDLE', 'UTILITY'...).
const BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg';
const FILE = { top: 'top', jungle: 'jungle', mid: 'middle', adc: 'bottom', support: 'utility' };
const ALIAS = { middle: 'mid', bottom: 'adc', bot: 'adc', utility: 'support' };

export default function RoleIcon({ role, className = 'h-3.5 w-3.5' }) {
    if (!role) return null;
    const key = String(role).toLowerCase();
    const file = FILE[ALIAS[key] ?? key];
    if (!file) return null;
    const url = `${BASE}/position-${file}.svg`;
    return (
        <span aria-hidden title={String(role)}
              className={`inline-block shrink-0 bg-gradient-to-r from-accent to-violet ${className}`}
              style={{ mask: `url(${url}) center / contain no-repeat`, WebkitMask: `url(${url}) center / contain no-repeat` }} />
    );
}