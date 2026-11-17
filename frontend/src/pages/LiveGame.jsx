import { useState, useEffect, useRef } from 'react';
import { Radio, Search, Clock, AlertCircle, Sparkles, ExternalLink, RefreshCw, Loader2, Play } from 'lucide-react';
import { Glass, Tile } from '../components/ui';
import RoleIcon from '../components/RoleIcon';
import RegionSelect from '../components/RegionSelect';
import { SEARCH_REGIONS } from '../lib/constants';
import { champIcon, champId, loadAssets, getPlayerLiveGame } from '../services/riotService';
import { navigate } from '../hooks/useUrl';

const REGION_LIST = Object.keys(SEARCH_REGIONS);

// ── Official DDragon Image Resolvers ──
const SPELL_ICONS = {
    Flash: 'https://ddragon.leagueoflegends.com/cdn/14.23.1/img/spell/SummonerFlash.png',
    Teleport: 'https://ddragon.leagueoflegends.com/cdn/14.23.1/img/spell/SummonerTeleport.png',
    Ignite: 'https://ddragon.leagueoflegends.com/cdn/14.23.1/img/spell/SummonerDot.png',
    Smite: 'https://ddragon.leagueoflegends.com/cdn/14.23.1/img/spell/SummonerSmite.png',
    Ghost: 'https://ddragon.leagueoflegends.com/cdn/14.23.1/img/spell/SummonerHaste.png',
    Heal: 'https://ddragon.leagueoflegends.com/cdn/14.23.1/img/spell/SummonerHeal.png',
    Barrier: 'https://ddragon.leagueoflegends.com/cdn/14.23.1/img/spell/SummonerBarrier.png',
    Cleanse: 'https://ddragon.leagueoflegends.com/cdn/14.23.1/img/spell/SummonerBoost.png',
    Exhaust: 'https://ddragon.leagueoflegends.com/cdn/14.23.1/img/spell/SummonerExhaust.png',
};

const RUNE_ICONS = {
    'Conqueror': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Conqueror/Conqueror.png',
    'Lethal Tempo': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png',
    'Press the Attack': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png',
    'Fleet Footwork': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png',
    'Electrocute': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/Electrocute/Electrocute.png',
    'Dark Harvest': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png',
    'Hail of Blades': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png',
    'First Strike': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png',
    'Glacial Augment': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png',
    'Grasp of the Undying': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png',
    'Aftershock': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png',
    'Guardian': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Guardian/Guardian.png',
    'Summon Aery': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/SummonAery/SummonAery.png',
    'Arcane Comet': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png',
    'Phase Rush': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png',
};

// ── Tree Styles Icons & Colors ──
const STYLE_ICONS = {
    Precision: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7201_Precision.png',
    Domination: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7200_Domination.png',
    Sorcery: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7202_Sorcery.png',
    Resolve: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7204_Resolve.png',
    Inspiration: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7203_Whimsy.png',
};

const STYLE_COLORS = {
    Precision: { text: 'text-amber-400', border: 'border-amber-400/40', bg: 'bg-amber-400/[0.04]' },
    Domination: { text: 'text-rose-400', border: 'border-rose-400/40', bg: 'bg-rose-400/[0.04]' },
    Sorcery: { text: 'text-indigo-400', border: 'border-indigo-400/40', bg: 'bg-indigo-400/[0.04]' },
    Resolve: { text: 'text-emerald-400', border: 'border-emerald-400/40', bg: 'bg-emerald-400/[0.04]' },
    Inspiration: { text: 'text-sky-400', border: 'border-sky-400/40', bg: 'bg-sky-400/[0.04]' },
};

const ALL_RUNE_ICONS = {
    ...RUNE_ICONS,
    'Triumph': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Triumph.png',
    'Presence of Mind': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png',
    'Legend: Alacrity': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendAlacrity/LegendAlacrity.png',
    'Legend: Bloodline': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendBloodline/LegendBloodline.png',
    'Legend: Haste': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendHaste/LegendHaste.png',
    'Coup de Grace': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png',
    'Cut Down': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CutDown/CutDown.png',
    'Last Stand': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LastStand/LastStand.png',

    'Cheap Shot': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/CheapShot/CheapShot.png',
    'Taste of Blood': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png',
    'Sudden Impact': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/SuddenImpact/SuddenImpact.png',
    'Eyeball Collection': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/EyeballCollection/EyeballCollection.png',
    'Treasure Hunter': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/TreasureHunter/TreasureHunter.png',
    'Relentless Hunter': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/RelentlessHunter/RelentlessHunter.png',
    'Ultimate Hunter': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/UltimateHunter/UltimateHunter.png',

    'Manaflow Band': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png',
    'Transcendence': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Transcendence/Transcendence.png',
    'Celerity': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Celerity/CelerityTemp.png',
    'Absolute Focus': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/AbsoluteFocus/AbsoluteFocus.png',
    'Scorch': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Scorch/Scorch.png',
    'Gathering Storm': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/GatheringStorm/GatheringStorm.png',

    'Demolish': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Demolish/Demolish.png',
    'Font of Life': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/FontOfLife/FontOfLife.png',
    'Conditioning': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Conditioning/Conditioning.png',
    'Second Wind': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/SecondWind/SecondWind.png',
    'Bone Plating': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/BonePlating/BonePlating.png',
    'Overgrowth': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Overgrowth/Overgrowth.png',
    'Revitalize': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Revitalize/Revitalize.png',
    'Unflinching': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Unflinching/Unflinching.png',

    'Hextech Flashtraption': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/HextechFlashtraption/HextechFlashtraption.png',
    'Magical Footwear': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png',
    'Triple Tonic': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/TripleTonic/TripleTonic.png',
    'Biscuit Delivery': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png',
    'Cosmic Insight': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png',

    'Adaptive Force': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png',
    'Attack Speed': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAttackSpeedIcon.png',
    'Ability Haste': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsCDRIcon.png',
    'Move Speed': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsMovementSpeedIcon.png',
    'Scaling Health': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png',
    'Flat Health': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png',
    'Armor': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsArmorIcon.png',
    'Magic Resist': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsMagicResIcon.png',
};

function resolveRunePage(player) {
    if (player.runePage) return player.runePage;
    const r = player.rune;
    const c = player.champ;

    if (r === 'Conqueror') {
        return {
            primaryStyle: 'Precision',
            keystone: 'Conqueror',
            primaryRunes: ['Triumph', 'Legend: Haste', 'Last Stand'],
            secondaryStyle: 'Resolve',
            secondaryRunes: ['Second Wind', 'Overgrowth'],
            shards: ['Adaptive Force', 'Adaptive Force', 'Scaling Health'],
        };
    }
    if (r === 'Lethal Tempo') {
        return {
            primaryStyle: 'Precision',
            keystone: 'Lethal Tempo',
            primaryRunes: ['Presence of Mind', 'Legend: Bloodline', 'Cut Down'],
            secondaryStyle: 'Inspiration',
            secondaryRunes: ['Magical Footwear', 'Cosmic Insight'],
            shards: ['Attack Speed', 'Adaptive Force', 'Scaling Health'],
        };
    }
    if (r === 'Fleet Footwork') {
        return {
            primaryStyle: 'Precision',
            keystone: 'Fleet Footwork',
            primaryRunes: ['Presence of Mind', 'Legend: Bloodline', 'Coup de Grace'],
            secondaryStyle: 'Sorcery',
            secondaryRunes: ['Celerity', 'Gathering Storm'],
            shards: ['Adaptive Force', 'Adaptive Force', 'Scaling Health'],
        };
    }
    if (r === 'Press the Attack') {
        return {
            primaryStyle: 'Precision',
            keystone: 'Press the Attack',
            primaryRunes: ['Presence of Mind', 'Legend: Bloodline', 'Cut Down'],
            secondaryStyle: 'Inspiration',
            secondaryRunes: ['Biscuit Delivery', 'Cosmic Insight'],
            shards: ['Attack Speed', 'Adaptive Force', 'Scaling Health'],
        };
    }
    if (r === 'Electrocute') {
        return {
            primaryStyle: 'Domination',
            keystone: 'Electrocute',
            primaryRunes: ['Taste of Blood', 'Eyeball Collection', 'Ultimate Hunter'],
            secondaryStyle: 'Sorcery',
            secondaryRunes: ['Manaflow Band', 'Transcendence'],
            shards: ['Adaptive Force', 'Adaptive Force', 'Move Speed'],
        };
    }
    if (r === 'Dark Harvest') {
        return {
            primaryStyle: 'Domination',
            keystone: 'Dark Harvest',
            primaryRunes: ['Sudden Impact', 'Eyeball Collection', 'Treasure Hunter'],
            secondaryStyle: 'Inspiration',
            secondaryRunes: ['Magical Footwear', 'Cosmic Insight'],
            shards: ['Adaptive Force', 'Adaptive Force', 'Scaling Health'],
        };
    }
    if (r === 'First Strike') {
        return {
            primaryStyle: 'Inspiration',
            keystone: 'First Strike',
            primaryRunes: ['Magical Footwear', 'Triple Tonic', 'Cosmic Insight'],
            secondaryStyle: 'Sorcery',
            secondaryRunes: ['Manaflow Band', 'Transcendence'],
            shards: ['Ability Haste', 'Adaptive Force', 'Scaling Health'],
        };
    }
    if (r === 'Glacial Augment' || c === 'Thresh') {
        return {
            primaryStyle: 'Inspiration',
            keystone: 'Glacial Augment',
            primaryRunes: ['Hextech Flashtraption', 'Biscuit Delivery', 'Cosmic Insight'],
            secondaryStyle: 'Resolve',
            secondaryRunes: ['Bone Plating', 'Unflinching'],
            shards: ['Ability Haste', 'Move Speed', 'Flat Health'],
        };
    }
    if (r === 'Grasp of the Undying') {
        return {
            primaryStyle: 'Resolve',
            keystone: 'Grasp of the Undying',
            primaryRunes: ['Demolish', 'Second Wind', 'Overgrowth'],
            secondaryStyle: 'Precision',
            secondaryRunes: ['Triumph', 'Legend: Alacrity'],
            shards: ['Attack Speed', 'Adaptive Force', 'Scaling Health'],
        };
    }
    if (r === 'Summon Aery') {
        return {
            primaryStyle: 'Sorcery',
            keystone: 'Summon Aery',
            primaryRunes: ['Manaflow Band', 'Transcendence', 'Scorch'],
            secondaryStyle: 'Inspiration',
            secondaryRunes: ['Biscuit Delivery', 'Cosmic Insight'],
            shards: ['Ability Haste', 'Adaptive Force', 'Flat Health'],
        };
    }
    if (r === 'Guardian') {
        return {
            primaryStyle: 'Resolve',
            keystone: 'Guardian',
            primaryRunes: ['Font of Life', 'Conditioning', 'Revitalize'],
            secondaryStyle: 'Inspiration',
            secondaryRunes: ['Biscuit Delivery', 'Cosmic Insight'],
            shards: ['Ability Haste', 'Armor', 'Flat Health'],
        };
    }
    return {
        primaryStyle: 'Precision',
        keystone: r || 'Conqueror',
        primaryRunes: ['Triumph', 'Legend: Haste', 'Last Stand'],
        secondaryStyle: 'Resolve',
        secondaryRunes: ['Second Wind', 'Overgrowth'],
        shards: ['Adaptive Force', 'Adaptive Force', 'Scaling Health'],
    };
}

function formatDuration(sec) {
    if (!sec) return '00:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// ── Compact Player Row Component for Split Screen (No empty items) ──
function PlayerRow({ player, isBlue, isTarget, onInspectPlayer, onInspectRunes }) {
    const champImgUrl = champIcon(player.champ);

    return (
        <div
            onClick={() => onInspectPlayer?.(player)}
            className={`group relative flex items-center justify-between gap-3 rounded-2xl border p-2.5 sm:px-3.5 sm:py-2.5 transition duration-150 cursor-pointer ${
                isTarget || player.isYou
                    ? 'border-accent bg-accent/[0.09] shadow-[0_0_24px_rgba(94,225,255,0.2)] ring-1 ring-accent/60'
                    : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
            }`}
        >
            {/* Section 1: Role & Champion Avatar */}
            <div className="flex items-center gap-2.5 shrink-0">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/50 border border-white/10" title={`Role: ${player.role}`}>
                    <RoleIcon role={player.role} className="h-4 w-4" />
                </div>

                <div
                    className="relative shrink-0 cursor-pointer group/champ"
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/champions/${encodeURIComponent(champId(player.champ))}`);
                    }}
                    title={`Go to champion page for ${player.champ}`}
                >
                    <Tile label={player.champ} src={champImgUrl} className="h-11 w-11 !rounded-xl border border-white/15 transition group-hover/champ:scale-105 group-hover/champ:border-accent" />
                    <span className={`absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded text-[9px] font-bold shadow ${isBlue ? 'bg-sky-500 text-ink' : 'bg-rose-500 text-white'}`}>
                        {player.role ? player.role[0].toUpperCase() : '?'}
                    </span>
                </div>
            </div>

            {/* Section 2: Player Details & Rank */}
            <div className="min-w-0 flex-1 truncate">
                <div className="flex items-center gap-1.5 truncate">
                    <span className={`text-sm font-bold truncate ${isTarget || player.isYou ? 'text-accent' : 'text-white'}`} title={player.name}>
                        {player.name}
                    </span>
                    <span className="text-[11px] text-white/40 shrink-0">#{player.tag}</span>
                    {(isTarget || player.isYou) && (
                        <span className="rounded bg-accent/25 px-1.5 py-0.2 text-[8px] font-bold uppercase text-accent tracking-wider shrink-0">
                            {player.isYou ? 'YOU' : 'SEARCHED'}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/50 mt-0.5 truncate">
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/champions/${encodeURIComponent(champId(player.champ))}`);
                        }}
                        className="font-semibold text-white/85 transition hover:text-accent hover:underline cursor-pointer"
                        title={`Go to champion page for ${player.champ}`}
                    >
                        {player.champ}
                    </span>
                    <span>·</span>
                    <span className="font-medium text-amber-300 truncate">{player.rank} {player.lp ? `(${player.lp} LP)` : ''}</span>
                </div>
            </div>

            {/* Section 3: Summoner Spells & Keystone */}
            <div className="flex shrink-0 items-center justify-center gap-1.5">
                <div className="flex flex-col gap-1 items-center justify-center">
                    {(player.spells || ['Flash', 'Teleport']).map((sp, idx) => (
                        <img key={idx} src={SPELL_ICONS[sp] || SPELL_ICONS.Flash} alt={sp} title={`Spell: ${sp}`}
                             className="h-4.5 w-4.5 rounded border border-white/20 object-cover shadow-sm transition hover:scale-110" />
                    ))}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onInspectRunes?.(player);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/60 p-1 shadow-inner transition hover:scale-110 hover:border-accent hover:shadow-[0_0_12px_rgba(94,225,255,0.4)] cursor-pointer"
                    title={`Click to inspect full rune page (${player.rune})`}
                >
                    <img src={RUNE_ICONS[player.rune] || RUNE_ICONS.Conqueror} alt={player.rune}
                         className="h-6 w-6 object-contain drop-shadow" />
                </button>
            </div>

            {/* Section 4: Win rate & Performance */}
            <div className="w-16 shrink-0 text-right">
                <p className={`text-xs font-bold tabular-nums ${player.wr >= 50 ? 'text-sky-400' : 'text-rose-400'}`}>
                    {player.wr}% WR
                </p>
                <p className="text-[10px] text-white/40 tabular-nums">
                    {player.games}g
                </p>
            </div>
        </div>
    );
}

// ── Live Game View (Split Screen Layout) ──
function LiveGameView({ match, assets, searchedQuery, onInspectPlayer, onInspectRunes, onRefresh, isRefreshing }) {
    const [seconds, setSeconds] = useState(match.gameTimeSeconds || 0);

    useEffect(() => {
        setSeconds(match.gameTimeSeconds || 0);
        const interval = setInterval(() => {
            setSeconds((s) => s + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [match]);

    // Check which team the searched player is on so their team is ALWAYS on the LEFT
    const isSearched = (p) => {
        if (!p) return false;
        if (p.isYou) return true;
        if (!searchedQuery) return false;
        const q = searchedQuery.toLowerCase().trim();
        const cleanQ = q.split('#')[0].trim();
        const pName = (p.name || '').toLowerCase().trim();
        return pName === cleanQ || `${pName}#${(p.tag || '').toLowerCase()}` === q;
    };

    const searchedInBlue = match.blueTeam?.players?.some(isSearched);
    const searchedInRed = match.redTeam?.players?.some(isSearched);

    // If the searched player is in Red Team, Red is on the Left! Otherwise Blue is on the Left.
    const leftTeam = searchedInRed ? match.redTeam : match.blueTeam;
    const rightTeam = searchedInRed ? match.blueTeam : match.redTeam;
    const leftIsBlue = !searchedInRed;
    const rightIsBlue = searchedInRed;

    return (
        <Glass className="overflow-hidden border border-white/15 p-5 sm:p-6 shadow-2xl">
            {/* Match Header Bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="flex items-center gap-3">
                    <span className="relative flex h-3.5 w-3.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-[0_0_12px_#10b981]" />
                    </span>
                    <div>
                        <h2 className="font-display text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            <span>{match.mode || 'Ranked Solo/Duo'}</span>
                            <span className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-white/70">
                                {match.region || 'EUW'}
                            </span>
                        </h2>
                        {match.tier && (
                            <p className="text-xs text-white/50">
                                Average Match MMR: <span className="font-semibold text-amber-300">{match.tier}{match.avgLp != null ? ` (${match.avgLp} LP)` : ''}</span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5 py-1.5 text-sm font-semibold tabular-nums text-white">
                        <Clock size={15} className="text-accent" />
                        <span>{match.phase === 'champ_select' ? 'Champ Select' : formatDuration(seconds)}</span>
                    </div>

                    {onRefresh && (
                        <button onClick={onRefresh} disabled={isRefreshing}
                                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-50">
                            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                            <span>Refresh</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Split Screen Grid (Left: Searched Player Team / Right: Enemy Team) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* LEFT TEAM: Searched Player's Team */}
                <div className="space-y-3">
                    <div className={`flex items-center justify-between border-b pb-2 ${leftIsBlue ? 'border-sky-500/25' : 'border-rose-500/25'}`}>
                        <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${leftIsBlue ? 'bg-sky-400 shadow-[0_0_8px_#38bdf8]' : 'bg-rose-400 shadow-[0_0_8px_#fb7185]'}`} />
                            <span className={`font-display text-sm font-bold uppercase tracking-wider ${leftIsBlue ? 'text-sky-400' : 'text-rose-400'}`}>
                                {leftIsBlue ? 'Blue Team' : 'Red Team'}
                            </span>
                            {(searchedInBlue || searchedInRed) && (
                                <span className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent uppercase tracking-wider">
                                    Your Team
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-white/40">5 Champions</span>
                    </div>

                    <div className="space-y-2">
                        {leftTeam?.players?.map((p, i) => (
                            <PlayerRow
                                key={i}
                                player={p}
                                isBlue={leftIsBlue}
                                isTarget={isSearched(p)}
                                assets={assets}
                                onInspectPlayer={onInspectPlayer}
                                onInspectRunes={onInspectRunes}
                            />
                        ))}
                    </div>
                </div>

                {/* RIGHT TEAM: Opposing Team */}
                <div className="space-y-3">
                    <div className={`flex items-center justify-between border-b pb-2 ${rightIsBlue ? 'border-sky-500/25' : 'border-rose-500/25'}`}>
                        <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${rightIsBlue ? 'bg-sky-400 shadow-[0_0_8px_#38bdf8]' : 'bg-rose-400 shadow-[0_0_8px_#fb7185]'}`} />
                            <span className={`font-display text-sm font-bold uppercase tracking-wider ${rightIsBlue ? 'text-sky-400' : 'text-rose-400'}`}>
                                {rightIsBlue ? 'Blue Team' : 'Red Team'}
                            </span>
                            <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                                Enemy Team
                            </span>
                        </div>
                        <span className="text-xs text-white/40">5 Champions</span>
                    </div>

                    <div className="space-y-2">
                        {rightTeam?.players?.map((p, i) => (
                            <PlayerRow
                                key={i}
                                player={p}
                                isBlue={rightIsBlue}
                                isTarget={isSearched(p)}
                                assets={assets}
                                onInspectPlayer={onInspectPlayer}
                                onInspectRunes={onInspectRunes}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </Glass>
    );
}

// ── Player Inspect Modal ──
function PlayerModal({ player, onClose, onSearchProfile, onInspectRunes }) {
    if (!player) return null;
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-ink p-6 shadow-2xl animate-rise" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <div className="cursor-pointer group/av"
                         onClick={() => { navigate(`/champions/${encodeURIComponent(champId(player.champ))}`); onClose(); }}
                         title={`Go to champion page for ${player.champ}`}>
                        <Tile label={player.champ} src={champIcon(player.champ)} className="h-14 w-14 !rounded-xl transition group-hover/av:scale-105 group-hover/av:border-accent" />
                    </div>
                    <div>
                        <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                            {player.name} <span className="text-sm font-normal text-white/40">#{player.tag}</span>
                        </h3>
                        <p className="text-xs text-white/50">
                            <span className="font-semibold text-accent cursor-pointer hover:underline"
                                  onClick={() => { navigate(`/champions/${encodeURIComponent(champId(player.champ))}`); onClose(); }}
                                  title={`Go to champion page for ${player.champ}`}>
                                {player.champ}
                            </span>
                            <span> · {player.rank} ({player.lp} LP)</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="ml-auto rounded-lg bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20">✕</button>
                </div>

                <div className="mt-4 space-y-4">
                    {/* Spells & Runes */}
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Spells & Keystone</p>
                            <button onClick={() => { onClose(); onInspectRunes?.(player); }}
                                    className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1">
                                <Sparkles size={12} /> View Full Rune Page →
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex gap-1.5">
                                {player.spells?.map((sp, i) => (
                                    <div key={i} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] p-1.5">
                                        <img src={SPELL_ICONS[sp] || SPELL_ICONS.Flash} alt={sp} className="h-6 w-6 rounded" />
                                        <span className="text-xs text-white/80 font-medium">{sp}</span>
                                    </div>
                                ))}
                            </div>
                            <div onClick={() => { onClose(); onInspectRunes?.(player); }}
                                 className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] p-1.5 cursor-pointer hover:border-accent hover:bg-accent/10 transition group"
                                 title="Click to view full rune page">
                                <img src={RUNE_ICONS[player.rune] || RUNE_ICONS.Conqueror} alt={player.rune} className="h-6 w-6 rounded-full" />
                                <span className="text-xs text-white/80 font-medium">{player.rune}</span>
                                <span className="text-[10px] text-accent font-semibold ml-1">Runes ↗</span>
                            </div>
                        </div>
                    </div>

                    {/* Champion Mastery / Winrate */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-white/40">Performance on {player.champ}</p>
                            <p className="text-base font-bold text-white">{player.wr}% Win Rate</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-white/40">Total Games</p>
                            <p className="text-base font-bold text-white">{player.games} matches</p>
                        </div>
                    </div>

                    <button onClick={() => { onSearchProfile?.(player); onClose(); }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-ink transition hover:bg-white">
                        <ExternalLink size={16} /> View Full Profile History
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Complete League of Legends Rune Page Modal ──
function RunePageModal({ player, onClose }) {
    if (!player) return null;
    const runePage = resolveRunePage(player);
    const primColor = STYLE_COLORS[runePage.primaryStyle] || STYLE_COLORS.Precision;
    const secColor = STYLE_COLORS[runePage.secondaryStyle] || STYLE_COLORS.Resolve;

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 backdrop-blur-md" onClick={onClose}>
            <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-ink p-6 shadow-2xl animate-rise"
                 onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3.5">
                        <div className="cursor-pointer group/av"
                             onClick={() => { navigate(`/champions/${encodeURIComponent(champId(player.champ))}`); onClose(); }}
                             title={`Go to champion page for ${player.champ}`}>
                            <Tile label={player.champ} src={champIcon(player.champ)} className="h-14 w-14 !rounded-2xl border border-white/20 transition group-hover/av:scale-105 group-hover/av:border-accent" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-display text-xl font-bold text-white">
                                    {player.name}
                                </h3>
                                <span className="text-xs text-white/40">#{player.tag}</span>
                            </div>
                            <p className="text-xs text-white/60 mt-0.5 flex items-center gap-2">
                                <span className="cursor-pointer font-semibold text-accent hover:underline"
                                      onClick={() => { navigate(`/champions/${encodeURIComponent(champId(player.champ))}`); onClose(); }}
                                      title={`Go to champion page for ${player.champ}`}>
                                    {player.champ}
                                </span>
                                <span>·</span>
                                <span className="font-medium text-amber-300">{player.rank}</span>
                                <span>·</span>
                                <span className="text-white/85 font-medium">Full Rune Page</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-xl bg-white/10 p-2 text-white/60 hover:bg-white/20 hover:text-white transition">
                        ✕
                    </button>
                </div>

                {/* Rune Page Content (2-Column Trees) */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Primary Tree */}
                    <div className={`rounded-2xl border ${primColor.border} ${primColor.bg} p-4.5 space-y-4`}>
                        <div className="flex items-center gap-2.5 border-b border-white/10 pb-2.5">
                            <img src={STYLE_ICONS[runePage.primaryStyle]} alt={runePage.primaryStyle} className="h-7 w-7 object-contain" />
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Primary Path</span>
                                <h4 className={`text-base font-bold ${primColor.text}`}>{runePage.primaryStyle}</h4>
                            </div>
                        </div>

                        {/* Keystone */}
                        <div className="flex items-center gap-3.5 rounded-xl border border-white/15 bg-black/40 p-3">
                            <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-amber-400/60 bg-black/70 shadow-[0_0_15px_rgba(251,191,36,0.25)]">
                                <img src={RUNE_ICONS[runePage.keystone] || RUNE_ICONS.Conqueror} alt={runePage.keystone}
                                     className="h-10 w-10 object-contain drop-shadow" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Keystone Rune</span>
                                <p className="text-base font-bold text-white">{runePage.keystone}</p>
                            </div>
                        </div>

                        {/* Minor Runes */}
                        <div className="space-y-2">
                            {runePage.primaryRunes.map((runeName, idx) => (
                                <div key={idx} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/50 border border-white/15">
                                        <img src={ALL_RUNE_ICONS[runeName] || RUNE_ICONS.Conqueror} alt={runeName} className="h-6 w-6 object-contain" />
                                    </div>
                                    <div>
                                        <span className="text-[9px] uppercase tracking-wider text-white/40">Slot {idx + 1}</span>
                                        <p className="text-sm font-semibold text-white/90">{runeName}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Secondary Tree & Stat Shards */}
                    <div className="space-y-4">
                        <div className={`rounded-2xl border ${secColor.border} ${secColor.bg} p-4.5 space-y-3`}>
                            <div className="flex items-center gap-2.5 border-b border-white/10 pb-2">
                                <img src={STYLE_ICONS[runePage.secondaryStyle]} alt={runePage.secondaryStyle} className="h-6 w-6 object-contain" />
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Secondary Path</span>
                                    <h4 className={`text-sm font-bold ${secColor.text}`}>{runePage.secondaryStyle}</h4>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {runePage.secondaryRunes.map((runeName, idx) => (
                                    <div key={idx} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/50 border border-white/15">
                                            <img src={ALL_RUNE_ICONS[runeName] || RUNE_ICONS.Conqueror} alt={runeName} className="h-5 w-5 object-contain" />
                                        </div>
                                        <div>
                                            <span className="text-[9px] uppercase tracking-wider text-white/40">Secondary {idx + 1}</span>
                                            <p className="text-xs font-semibold text-white/90">{runeName}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Stat Shards */}
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 block">Stat Shards</span>
                            <div className="grid grid-cols-3 gap-2">
                                {runePage.shards.map((shard, idx) => (
                                    <div key={idx} className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.08] bg-black/40 p-2 text-center"
                                         title={shard}>
                                        <img src={ALL_RUNE_ICONS[shard] || ALL_RUNE_ICONS['Adaptive Force']} alt={shard} className="h-6 w-6 object-contain" />
                                        <span className="text-[10px] font-medium text-white/70 line-clamp-1">{shard}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                    <button onClick={() => { navigate(`/champions/${encodeURIComponent(champId(player.champ))}`); onClose(); }}
                            className="flex items-center gap-2 text-xs font-semibold text-accent hover:underline">
                        <Sparkles size={14} /> View all builds and popular runes for {player.champ}
                    </button>
                    <button onClick={onClose}
                            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function LiveGame({ summoner, onSearch }) {
    const [searchName, setSearchName] = useState('');
    const [region, setRegion] = useState(summoner?.region || 'EUNE');
    const [assets, setAssets] = useState(null);
    const [inspectingPlayer, setInspectingPlayer] = useState(null);
    const [inspectingRunePlayer, setInspectingRunePlayer] = useState(null);

    // ── Pure Lazy Single Live Match State ──
    const [searchedId, setSearchedId] = useState('');
    const [searchedRegion, setSearchedRegion] = useState('');
    const [liveMatch, setLiveMatch] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState('');
    const reqId = useRef(0); // only the latest search may update the page

    useEffect(() => {
        loadAssets().then(setAssets).catch(() => {});
    }, []);

    // ── Single on-demand request: GET /v1/players/{region}/{name}/{tag}/live ──
    const searchLiveGame = async (riotIdToSearch, regToSearch) => {
        const targetId = (riotIdToSearch || searchName).trim();
        const targetReg = regToSearch || region;
        if (!targetId) return;

        setLoading(true);
        setError('');
        setHasSearched(true);
        setSearchedId(targetId);
        setSearchedRegion(targetReg);

        const id = ++reqId.current;
        try {
            const data = await getPlayerLiveGame(targetId, targetReg);
            if (id !== reqId.current) return;
            setLiveMatch(data);
        } catch (err) {
            if (id !== reqId.current) return;
            setLiveMatch(null);
            setError(err.message || 'Player not found or spectator data unavailable.');
        } finally {
            if (id === reqId.current) setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        searchLiveGame();
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            {/* Header */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
                <div>
                    <div className="flex items-center gap-2.5">
                        <Radio size={26} className="text-accent animate-pulse" />
                        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
                            <span className="text-shine">Live</span> <span className="text-accent-shine">Spectator.</span>
                        </h1>
                    </div>
                    <p className="mt-1.5 text-sm text-white/50">
                        Real-time active game spectator directly from Riot API. Split-team view with full runes and match stats.
                    </p>
                </div>

                {/* Quick chip for logged-in / active user */}
                {summoner?.name && (
                    <button
                        onClick={() => {
                            setSearchName(summoner.name);
                            setRegion(summoner.region || 'EUNE');
                            searchLiveGame(summoner.name, summoner.region || 'EUNE');
                        }}
                        className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent hover:text-ink shadow-sm"
                    >
                        <Play size={13} />
                        <span>Check My Game ({summoner.name})</span>
                    </button>
                )}
            </div>

            {/* Centered Search Hero Bar */}
            <div className="mb-8 mx-auto max-w-2xl">
                <form onSubmit={handleSearch}
                      className="flex items-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.04] p-2 pl-4 shadow-xl backdrop-blur-md transition focus-within:border-accent/60 focus-within:shadow-[0_0_30px_rgba(94,225,255,0.15)]">
                    <Search size={18} className="text-white/40 shrink-0" />
                    <input
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        placeholder="Search player's Riot ID (e.g. Lucaaaa#EUNE or Caps#EUW)"
                        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/35"
                    />
                    <RegionSelect value={region} onChange={setRegion} options={REGION_LIST} />
                    <button
                        type="submit"
                        disabled={loading || !searchName.trim()}
                        className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-ink shadow-[0_0_20px_rgba(94,225,255,0.4)] transition hover:bg-white active:scale-95 disabled:opacity-40"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                        <span>Check Live Game</span>
                    </button>
                </form>
            </div>

            {/* Live Match Results */}
            {loading && !liveMatch ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-accent/20 bg-accent/[0.04] p-12 text-center">
                    <Loader2 className="animate-spin text-accent" size={32} />
                    <h3 className="font-display text-lg font-bold text-white">Checking Riot Spectator API...</h3>
                    <p className="text-xs text-white/50 max-w-md">
                        Fetching live active game for <strong className="text-white">{searchedId || searchName}</strong> on server <strong className="text-accent">{searchedRegion || region}</strong>.
                    </p>
                </div>
            ) : liveMatch ? (
                <div className="space-y-4">
                    <LiveGameView
                        match={liveMatch}
                        assets={assets}
                        searchedQuery={searchedId}
                        onInspectPlayer={setInspectingPlayer}
                        onInspectRunes={setInspectingRunePlayer}
                        onRefresh={() => searchLiveGame(searchedId, searchedRegion)}
                        isRefreshing={loading}
                    />
                </div>
            ) : hasSearched ? (
                <Glass className="p-10 text-center border-dashed border-white/15">
                    <AlertCircle size={36} className="mx-auto text-amber-400 mb-3" />
                    <h3 className="font-display text-xl font-bold text-white">
                        {error ? 'Unable to Fetch Live Game' : 'No Active Game Found'}
                    </h3>
                    <p className="text-sm text-white/55 max-w-md mx-auto mt-2">
                        {error
                            ? error
                            : <>Player <strong className="text-white font-semibold">{searchedId}</strong> ({searchedRegion}) is not currently in an active game. Matches appear once the loading screen starts.</>
                        }
                    </p>
                    <div className="mt-5 flex justify-center gap-3">
                        <button
                            onClick={() => searchLiveGame(searchedId, searchedRegion)}
                            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 transition"
                        >
                            <RefreshCw size={13} />
                            <span>Try Again</span>
                        </button>
                    </div>
                </Glass>
            ) : (
                <Glass className="p-12 text-center border-dashed border-white/15 max-w-2xl mx-auto">
                    <Clock size={40} className="mx-auto text-white/20 mb-3" />
                    <h3 className="font-display text-xl font-bold text-white">Enter a Riot ID to Spectate</h3>
                    <p className="text-sm text-white/45 max-w-md mx-auto mt-2 leading-relaxed">
                        To save API requests and prevent rate-limiting, live game queries are loaded lazily on demand.
                        Enter any player currently in a League of Legends match above (e.g. <span className="text-accent font-semibold">Lucaaaa#EUNE</span>) to inspect their live runes, spells, and team matchup in split view.
                    </p>
                </Glass>
            )}

            {/* Player Details Modal */}
            {inspectingPlayer && (
                <PlayerModal
                    player={inspectingPlayer}
                    onClose={() => setInspectingPlayer(null)}
                    onInspectRunes={setInspectingRunePlayer}
                    onSearchProfile={(p) => onSearch(`${p.name}#${p.tag}`, searchedRegion || region)}
                />
            )}

            {/* Full Rune Page Modal */}
            {inspectingRunePlayer && (
                <RunePageModal
                    player={inspectingRunePlayer}
                    onClose={() => setInspectingRunePlayer(null)}
                />
            )}
        </div>
    );
}
