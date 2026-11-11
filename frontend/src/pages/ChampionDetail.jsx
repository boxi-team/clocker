import { ArrowLeft } from 'lucide-react';
import { Glass, Tile } from '../components/ui';
import Link from '../components/Link';
import BuildSection from '../components/champion/BuildSection';
import MatchupsSection from '../components/champion/MatchupsSection';
import AbilitiesSection from '../components/champion/AbilitiesSection';
import StatsSection from '../components/champion/StatsSection';
import SkinCarousel from '../components/champion/SkinCarousel';
import { ErrorState, LowSample, SectionTitle, Select, pct, num, wrColor } from '../components/champion/common';
import { useRequest } from '../hooks/useRequest';
import { useSearchParams } from '../hooks/useUrl';
import { loadAssets, getChampion, getChampionFull, getChampionBuilds, getMatchups, getPatches } from '../services/riotService';
import { TIERS, ROLES, QUEUES, REGIONS, DEFAULTS, ROLE_LABEL, QUEUE_LABEL, tierLabel } from '../lib/constants';

const NO_ASSETS = { cdn: '', itemMap: {}, spellMap: {}, runeMap: {} };

const Stat = ({ label, value, className = '' }) => (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{label}</p>
        <p className={`font-display text-xl font-bold tabular-nums ${className}`}>{value}</p>
    </div>
);

export default function ChampionDetail({ id }) {
    const [params, set] = useSearchParams();
    // All filters live in the URL: /champions/Ahri?tier=gold&role=mid&vs=Zed
    const f = {
        patch: params.get('patch') || DEFAULTS.patch, tier: params.get('tier') || DEFAULTS.tier,
        queue: params.get('queue') || DEFAULTS.queue, region: params.get('region') || DEFAULTS.region,
        role: params.get('role') || undefined,
    };
    const vs = params.get('vs') || null;
    const key = JSON.stringify(f);

    const full = useRequest(() => getChampionFull(id, f), [id, key]);
    const detail = useRequest(() => getChampion(id).catch(() => null), [id]);   // base stats + lore (not in /full)
    const assetsReq = useRequest(() => loadAssets(), []);
    const matchups = useRequest(() => getMatchups(id, f).catch(() => null), [id, key]);
    const vsBuild = useRequest(() => (vs ? getChampionBuilds(id, { ...f, vs }) : null), [id, key, vs]);
    const patches = useRequest(() => getPatches().catch(() => ({ data: [] })), []);

    const assets = assetsReq.data ?? NO_ASSETS;
    const setFilter = (k, def) => (v) => set({ [k]: v === def ? null : v, vs: null });
    const minors = [...new Set((patches.data?.data ?? []).map((p) => p.version.split('.').slice(0, 2).join('.')))];

    const back = (
        <Link href="/champions" className="mb-5 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white">
            <ArrowLeft size={15} /> All champions
        </Link>
    );

    if (full.error) return <div className="mx-auto max-w-7xl px-4 py-8">{back}<ErrorState error={full.error} onRetry={full.retry} /></div>;
    if (!full.data) return <div className="mx-auto max-w-7xl space-y-4 px-4 py-8">{back}<div className="skeleton h-72" /><div className="skeleton h-96" /></div>;

    const c = full.data.data;
    const meta = full.data.meta;
    const version = meta.version;
    const st = c.stats;
    const empty = meta.totalMatches === 0 || st.games === 0;
    const build = vs ? vsBuild.data?.data : c.build;

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            {back}

            <section className="relative overflow-hidden rounded-3xl border border-white/10">
                <img src={c.splashUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/20" />
                <div className="relative flex flex-col gap-6 p-6 pt-40 md:p-10 md:pt-52">
                    <div className="flex items-center gap-4">
                        <Tile label={c.name} src={c.iconUrl} className="h-20 w-20 !rounded-2xl ring-2 ring-accent/40" />
                        <div>
                            <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">{c.name}</h1>
                            <p className="text-white/60">{c.title}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {c.tags.map((t) => <span key={t} className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">{t}</span>)}
                                {st.lowSample && !empty && <LowSample />}
                            </div>
                        </div>
                    </div>
                    {empty ? (
                        <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/60">No ranked matches for these filters yet. Try “All ranks” or another patch; static info below still works.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                            <Stat label="Win rate" value={pct(st.winRate)} className={wrColor(st.winRate)} />
                            <Stat label="Pick rate" value={pct(st.pickRate)} />
                            <Stat label="Ban rate" value={pct(st.banRate)} />
                            <Stat label="KDA" value={num(st.kda, 2)} />
                            <Stat label="Games" value={num(st.games)} />
                        </div>
                    )}
                </div>
            </section>

            <Glass className="mt-4 flex flex-wrap items-end gap-3 p-4">
                <Select label="Rank" value={f.tier} onChange={setFilter('tier', DEFAULTS.tier)} options={TIERS.map((t) => [t, tierLabel(t)])} />
                <Select label="Role" value={f.role ?? ''} onChange={(v) => set({ role: v, vs: null })} options={[['', build?.role ? `Auto (${ROLE_LABEL[build.role]})` : 'Auto'], ...ROLES.map((r) => [r, ROLE_LABEL[r]])]} />
                <Select label="Queue" value={f.queue} onChange={setFilter('queue', DEFAULTS.queue)} options={QUEUES.map((x) => [x, QUEUE_LABEL[x]])} />
                <Select label="Region" value={f.region} onChange={setFilter('region', 'all')} options={[['all', 'All regions'], ...REGIONS.map((r) => [r, r.toUpperCase()])]} />
                <Select label="Patch" value={f.patch} onChange={setFilter('patch', 'latest')} options={[['latest', 'Latest'], ...minors.map((m) => [m, m])]} />
                <span className="ml-auto pb-2 text-xs text-white/40 tabular-nums">Patch {meta.patch ?? '–'} · {num(meta.totalMatches)} matches</span>
            </Glass>

            <div className="mt-10 space-y-12">
                <section>
                    <SectionTitle id="build">Build</SectionTitle>
                    <BuildSection build={build} version={version} assets={assets} vs={vs} loading={vs && vsBuild.loading}
                                  onClearVs={() => set({ vs: null })} />
                </section>

                <section>
                    <SectionTitle id="matchups">Matchups</SectionTitle>
                    <MatchupsSection data={matchups.data?.data} version={version} vs={vs} name={c.name}
                                     onPick={(opp) => { set({ vs: opp }); document.getElementById('build')?.scrollIntoView({ behavior: 'smooth' }); }} />
                </section>

                <section>
                    <SectionTitle id="abilities">Abilities</SectionTitle>
                    <AbilitiesSection abilities={c.abilities} lore={detail.data?.data?.lore} />
                </section>

                <section>
                    <SectionTitle id="stats">Stats</SectionTitle>
                    <StatsSection stats={empty ? null : st} base={detail.data?.data?.stats} />
                </section>

                <section>
                    <SectionTitle id="skins">Skins</SectionTitle>
                    <SkinCarousel skins={c.skins} champName={c.name} />
                </section>
            </div>
        </div>
    );
}
