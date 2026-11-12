import { useState, useEffect, useMemo } from 'react';
import { Radio, Search, Shield, Clock, AlertCircle, Sparkles, ChevronRight, LayoutList, Columns2, ExternalLink, Zap, RefreshCw, Loader2 } from 'lucide-react';
import { Glass, Tile } from '../components/ui';
import RoleIcon from '../components/RoleIcon';
import RegionSelect from '../components/RegionSelect';
import { SEARCH_REGIONS } from '../lib/constants';
import { champIcon, loadAssets, getPlayerLiveGame, getFeaturedLiveGames } from '../services/riotService';
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

const itemImgUrl = (id) => (id ? `https://ddragon.leagueoflegends.com/cdn/14.23.1/img/item/${id}.png` : null);

// ── Tree Styles Icons & Colors ──
const STYLE_ICONS = {
    Precision: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7201_Precision.png',
    Domination: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7200_Domination.png',
    Sorcery: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7202_Sorcery.png',
    Resolve: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7204_Resolve.png',
    Inspiration: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7203_Whimsy.png',
};

const STYLE_COLORS = {
    Precision: { text: 'text-amber-400', border: 'border-amber-400/40', bg: 'bg-amber-400/[0.04]', badge: 'bg-amber-400/15 text-amber-300' },
    Domination: { text: 'text-rose-400', border: 'border-rose-400/40', bg: 'bg-rose-400/[0.04]', badge: 'bg-rose-400/15 text-rose-300' },
    Sorcery: { text: 'text-indigo-400', border: 'border-indigo-400/40', bg: 'bg-indigo-400/[0.04]', badge: 'bg-indigo-400/15 text-indigo-300' },
    Resolve: { text: 'text-emerald-400', border: 'border-emerald-400/40', bg: 'bg-emerald-400/[0.04]', badge: 'bg-emerald-400/15 text-emerald-300' },
    Inspiration: { text: 'text-sky-400', border: 'border-sky-400/40', bg: 'bg-sky-400/[0.04]', badge: 'bg-sky-400/15 text-sky-300' },
};

const ALL_RUNE_ICONS = {
    ...RUNE_ICONS,
    // Precision
    'Triumph': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Triumph.png',
    'Presence of Mind': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png',
    'Legend: Alacrity': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendAlacrity/LegendAlacrity.png',
    'Legend: Bloodline': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendBloodline/LegendBloodline.png',
    'Legend: Haste': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendHaste/LegendHaste.png',
    'Coup de Grace': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png',
    'Cut Down': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CutDown/CutDown.png',
    'Last Stand': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LastStand/LastStand.png',

    // Domination
    'Cheap Shot': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/CheapShot/CheapShot.png',
    'Taste of Blood': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png',
    'Sudden Impact': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/SuddenImpact/SuddenImpact.png',
    'Eyeball Collection': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/EyeballCollection/EyeballCollection.png',
    'Treasure Hunter': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/TreasureHunter/TreasureHunter.png',
    'Relentless Hunter': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/RelentlessHunter/RelentlessHunter.png',
    'Ultimate Hunter': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/UltimateHunter/UltimateHunter.png',

    // Sorcery
    'Manaflow Band': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png',
    'Transcendence': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Transcendence/Transcendence.png',
    'Celerity': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Celerity/CelerityTemp.png',
    'Absolute Focus': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/AbsoluteFocus/AbsoluteFocus.png',
    'Scorch': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Scorch/Scorch.png',
    'Gathering Storm': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/GatheringStorm/GatheringStorm.png',

    // Resolve
    'Demolish': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Demolish/Demolish.png',
    'Font of Life': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/FontOfLife/FontOfLife.png',
    'Conditioning': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Conditioning/Conditioning.png',
    'Second Wind': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/SecondWind/SecondWind.png',
    'Bone Plating': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/BonePlating/BonePlating.png',
    'Overgrowth': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Overgrowth/Overgrowth.png',
    'Revitalize': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Revitalize/Revitalize.png',
    'Unflinching': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Unflinching/Unflinching.png',

    // Inspiration
    'Hextech Flashtraption': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/HextechFlashtraption/HextechFlashtraption.png',
    'Magical Footwear': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png',
    'Triple Tonic': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/TripleTonic/TripleTonic.png',
    'Biscuit Delivery': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png',
    'Cosmic Insight': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png',

    // Stat Shards
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

// ── Spacious, Non-Squished Player Row with Perfectly Centered Spells & Runes ──
function PlayerRow({ player, isBlue, assets, onInspectPlayer, onInspectRunes }) {
    const champImgUrl = champIcon(player.champ);

    return (
        <div onClick={() => onInspectPlayer?.(player)}
             className={`group relative flex items-center justify-between gap-4 rounded-2xl border px-5 py-3 transition duration-150 hover:border-white/20 hover:bg-white/[0.04] cursor-pointer ${
                 player.isYou
                     ? 'border-accent bg-accent/[0.08] shadow-[0_0_24px_rgba(94,225,255,0.18)] ring-1 ring-accent/60'
                     : 'border-white/[0.07] bg-white/[0.02]'
             }`}>
            {/* Section 1: Role & Champion Avatar */}
            <div className="flex items-center gap-3 shrink-0">
                {/* Role Icon */}
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/50 border border-white/10" title={`Role: ${player.role}`}>
                    <RoleIcon role={player.role} className="h-5 w-5" />
                </div>

                {/* Champion Avatar (Clicking navigates to champion detail page) */}
                <div className="relative shrink-0 cursor-pointer group/champ"
                     onClick={(e) => {
                         e.stopPropagation();
                         navigate(`/champions/${encodeURIComponent(player.champ)}`);
                     }}
                     title={`Mergi la pagina campionului ${player.champ}`}>
                    <Tile label={player.champ} src={champImgUrl} className="h-12 w-12 !rounded-xl border border-white/15 transition group-hover/champ:scale-105 group-hover/champ:border-accent" />
                    <span className={`absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded text-[9px] font-bold shadow ${isBlue ? 'bg-sky-500 text-ink' : 'bg-rose-500 text-white'}`}>
                        {player.role ? player.role[0].toUpperCase() : '?'}
                    </span>
                </div>
            </div>

            {/* Section 2: Player Details & Rank (Fixed width so Spells/Runes/Items align across rows) */}
            <div className="w-52 shrink-0 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className={`text-base font-bold truncate ${player.isYou ? 'text-accent' : 'text-white'}`} title={player.name}>
                        {player.name}
                    </span>
                    <span className="text-xs text-white/40 shrink-0">#{player.tag}</span>
                    {player.isYou && (
                        <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-accent tracking-wider shrink-0">
                            YOU
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5 truncate">
                    {/* Champion Name link */}
                    <span onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/champions/${encodeURIComponent(player.champ)}`);
                          }}
                          className="font-semibold text-white/85 transition hover:text-accent hover:underline cursor-pointer"
                          title={`Mergi la pagina campionului ${player.champ}`}>
                        {player.champ}
                    </span>
                    <span>·</span>
                    <span className="font-medium text-amber-300">{player.rank} {player.lp ? `(${player.lp} LP)` : ''}</span>
                </div>
            </div>

            {/* Section 3: Summoner Spells & Keystone Rune - Perfectly Centered Vertically & Horizontally */}
            <div className="flex shrink-0 items-center justify-center gap-2.5 w-24">
                {/* 2 Summoner Spells stacked vertically (20px + 4px + 20px = 44px height) */}
                <div className="flex flex-col gap-1 items-center justify-center">
                    {(player.spells || ['Flash', 'Teleport']).map((sp, idx) => (
                        <img key={idx} src={SPELL_ICONS[sp] || SPELL_ICONS.Flash} alt={sp} title={`Spell: ${sp}`}
                             className="h-5 w-5 rounded-md border border-white/20 object-cover shadow-sm transition hover:scale-110" />
                    ))}
                </div>
                {/* Keystone Rune Circle (Clicking opens the Full Rune Page Modal!) */}
                <button onClick={(e) => {
                            e.stopPropagation();
                            onInspectRunes?.(player);
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 p-1 shadow-inner transition hover:scale-110 hover:border-accent hover:shadow-[0_0_15px_rgba(94,225,255,0.4)] cursor-pointer"
                        title={`Apasă pentru a vedea pagina completă de rune (${player.rune})`}>
                    <img src={RUNE_ICONS[player.rune] || RUNE_ICONS.Conqueror} alt={player.rune}
                         className="h-7 w-7 object-contain drop-shadow" />
                </button>
            </div>

            {/* Section 4: Build Items (6 Items + 1 Trinket) */}
            <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-black/45 p-1.5 border border-white/[0.08]">
                {(player.items || [0, 0, 0, 0, 0, 0, 3340]).map((itemId, idx) => {
                    const isTrinket = idx === 6;
                    const src = itemImgUrl(itemId);
                    return src ? (
                        <Tile key={idx} label={`Item ${itemId}`} src={src}
                              className={`h-8 w-8 !rounded-lg border border-white/10 ${isTrinket ? '!rounded-full border-amber-400/50' : ''}`} />
                    ) : (
                        <div key={idx} className={`h-8 w-8 border border-white/[0.06] bg-white/[0.02] ${isTrinket ? 'rounded-full border-dashed border-amber-400/20' : 'rounded-lg'}`} />
                    );
                })}
            </div>

            {/* Section 5: Win rate & Performance */}
            <div className="w-24 shrink-0 text-right">
                <p className={`text-sm font-bold tabular-nums ${player.wr >= 50 ? 'text-sky-400' : 'text-rose-400'}`}>
                    {player.wr}% WR
                </p>
                <p className="text-xs text-white/40 tabular-nums">
                    {player.games} games
                </p>
            </div>
        </div>
    );
}

// ── Full Champ Select & Live Game Visualizer (Spacious Stacked Layout) ──
function LiveGameView({ match, assets, onInspectPlayer, onInspectRunes }) {
    const [seconds, setSeconds] = useState(match.gameTimeSeconds);
    const [layoutMode, setLayoutMode] = useState('stacked'); // 'stacked' (full width) or 'split' (side by side)

    useEffect(() => {
        setSeconds(match.gameTimeSeconds);
        const interval = setInterval(() => {
            setSeconds((s) => s + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [match]);

    return (
        <Glass className="overflow-hidden p-6 border border-white/[0.1] bg-gradient-to-b from-white/[0.05] to-transparent shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            {/* Header */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-3">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-display text-xl font-bold text-white tracking-tight">
                                {match.phase === 'champ_select' ? 'Champ Select in Progress' : 'Live Match'}
                            </span>
                            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                                {match.phase === 'champ_select' ? 'SELECTING' : 'LIVE'}
                            </span>
                        </div>
                        <p className="text-xs text-white/50 mt-0.5">
                            {match.mode} · {match.tier} {match.avgLp ? `(~${match.avgLp} LP)` : ''} · {match.region}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* View Switcher: Stacked vs Split */}
                    <div className="hidden sm:flex rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
                        <button onClick={() => setLayoutMode('stacked')}
                                title="Stacked View (Spacious full width)"
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${layoutMode === 'stacked' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}>
                            <LayoutList size={13} /> Full Width
                        </button>
                        <button onClick={() => setLayoutMode('split')}
                                title="Split View (Side by side)"
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${layoutMode === 'split' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}>
                            <Columns2 size={13} /> Split
                        </button>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/40">
                        <span className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">P</span>
                        <span>Inspect build</span>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold tabular-nums text-white">
                        <Clock size={15} className="text-accent" />
                        {match.phase === 'champ_select' ? '00:45' : formatDuration(seconds)}
                    </div>
                </div>
            </div>

            {/* Bans Bar */}
            <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-white/[0.06] bg-black/35 p-3.5">
                <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Blue Bans:</span>
                    <div className="flex gap-1.5">
                        {match.blueTeam.bans.map((c, i) => (
                            <div key={i} className="relative group cursor-pointer" title={`Banned: ${c} (Apasă pentru detalii)`}
                                 onClick={() => navigate(`/champions/${encodeURIComponent(c)}`)}>
                                <Tile label={c} src={champIcon(c)} className="h-8 w-8 !rounded-lg opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition group-hover:scale-105" />
                                <span className="absolute inset-0 grid place-items-center text-rose-400 font-bold text-xs pointer-events-none">✕</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Red Bans:</span>
                    <div className="flex gap-1.5">
                        {match.redTeam.bans.map((c, i) => (
                            <div key={i} className="relative group cursor-pointer" title={`Banned: ${c} (Apasă pentru detalii)`}
                                 onClick={() => navigate(`/champions/${encodeURIComponent(c)}`)}>
                                <Tile label={c} src={champIcon(c)} className="h-8 w-8 !rounded-lg opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition group-hover:scale-105" />
                                <span className="absolute inset-0 grid place-items-center text-rose-400 font-bold text-xs pointer-events-none">✕</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Teams Display: Stacked (Default) vs Split */}
            {layoutMode === 'stacked' ? (
                <div className="space-y-8">
                    {/* Blue Team Section */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-sky-500/25 pb-2.5">
                            <span className="font-display text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]" /> Blue Team
                            </span>
                            <span className="text-xs text-white/40">5 Champions</span>
                        </div>
                        <div className="space-y-2">
                            {match.blueTeam.players.map((p, i) => (
                                <PlayerRow key={i} player={p} isBlue={true} assets={assets} onInspectPlayer={onInspectPlayer} onInspectRunes={onInspectRunes} />
                            ))}
                        </div>
                    </div>

                    {/* Red Team Section */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-rose-500/25 pb-2.5">
                            <span className="font-display text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_10px_#fb7185]" /> Red Team
                            </span>
                            <span className="text-xs text-white/40">5 Champions</span>
                        </div>
                        <div className="space-y-2">
                            {match.redTeam.players.map((p, i) => (
                                <PlayerRow key={i} player={p} isBlue={false} assets={assets} onInspectPlayer={onInspectPlayer} onInspectRunes={onInspectRunes} />
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid gap-6 xl:grid-cols-2">
                    {/* Blue Team Split */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-sky-500/25 pb-2">
                            <span className="font-display text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Blue Team
                            </span>
                            <span className="text-xs text-white/40">5 Champions</span>
                        </div>
                        <div className="space-y-2">
                            {match.blueTeam.players.map((p, i) => (
                                <PlayerRow key={i} player={p} isBlue={true} assets={assets} onInspectPlayer={onInspectPlayer} onInspectRunes={onInspectRunes} />
                            ))}
                        </div>
                    </div>

                    {/* Red Team Split */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-rose-500/25 pb-2">
                            <span className="font-display text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Red Team
                            </span>
                            <span className="text-xs text-white/40">5 Champions</span>
                        </div>
                        <div className="space-y-2">
                            {match.redTeam.players.map((p, i) => (
                                <PlayerRow key={i} player={p} isBlue={false} assets={assets} onInspectPlayer={onInspectPlayer} onInspectRunes={onInspectRunes} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </Glass>
    );
}

// ── Mini Apex Match Card (Bottom List) ──
function ApexMatchCard({ match, isSelected, onSelect }) {
    return (
        <div onClick={onSelect}
             className={`group cursor-pointer rounded-2xl border p-4 transition duration-150 hover:border-white/20 hover:bg-white/[0.04] ${isSelected ? 'border-accent bg-accent/[0.05] shadow-[0_0_15px_rgba(94,225,255,0.12)] ring-1 ring-accent/40' : 'border-white/[0.07] bg-white/[0.02]'}`}>
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-white tracking-wide">{match.tier} Lobby</span>
                    <span className="text-[11px] text-white/40">Avg {match.avgLp} LP</span>
                </div>
                <span className="flex items-center gap-1 rounded bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-medium text-white/60">
                    <Clock size={11} /> {match.phase === 'champ_select' ? 'Champ Select' : `${Math.floor(match.gameTimeSeconds / 60)}m`}
                </span>
            </div>

            {/* Matchup preview */}
            <div className="grid grid-cols-2 gap-3 border-t border-white/[0.05] pt-3">
                <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase text-sky-400">Blue Team</p>
                    <div className="flex gap-1.5">
                        {match.blueTeam.players.map((p, idx) => (
                            <Tile key={idx} label={p.champ} src={champIcon(p.champ)} className="h-8 w-8 !rounded-md" />
                        ))}
                    </div>
                </div>
                <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase text-rose-400">Red Team</p>
                    <div className="flex gap-1.5">
                        {match.redTeam.players.map((p, idx) => (
                            <Tile key={idx} label={p.champ} src={champIcon(p.champ)} className="h-8 w-8 !rounded-md" />
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-white/40 group-hover:text-accent transition">
                <span>Inspect full Champ Select, Build & Runes</span>
                <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </div>
        </div>
    );
}

// ── Detailed Build & Player Inspect Modal ──
function PlayerModal({ player, onClose, onSearchProfile, onInspectRunes }) {
    if (!player) return null;
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-ink p-6 shadow-2xl animate-rise" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <div className="cursor-pointer group/av"
                         onClick={() => { navigate(`/champions/${encodeURIComponent(player.champ)}`); onClose(); }}
                         title={`Mergi la pagina campionului ${player.champ}`}>
                        <Tile label={player.champ} src={champIcon(player.champ)} className="h-14 w-14 !rounded-xl transition group-hover/av:scale-105 group-hover/av:border-accent" />
                    </div>
                    <div>
                        <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                            {player.name} <span className="text-sm font-normal text-white/40">#{player.tag}</span>
                        </h3>
                        <p className="text-xs text-white/50">
                            <span className="font-semibold text-accent cursor-pointer hover:underline"
                                  onClick={() => { navigate(`/champions/${encodeURIComponent(player.champ)}`); onClose(); }}
                                  title={`Mergi la pagina campionului ${player.champ}`}>
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
                                <Sparkles size={12} /> Vezi Pagina Completă de Rune →
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
                                 title="Apasă pentru a vedea pagina completă de rune">
                                <img src={RUNE_ICONS[player.rune] || RUNE_ICONS.Conqueror} alt={player.rune} className="h-6 w-6 rounded-full" />
                                <span className="text-xs text-white/80 font-medium">{player.rune}</span>
                                <span className="text-[10px] text-accent font-semibold ml-1">Rune ↗</span>
                            </div>
                        </div>
                    </div>

                    {/* Current Items Build */}
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Inventory & Build Order</p>
                        <div className="flex gap-1.5 rounded-xl border border-white/10 bg-black/40 p-2">
                            {(player.items || [0, 0, 0, 0, 0, 0, 3340]).map((itemId, idx) => {
                                const src = itemImgUrl(itemId);
                                return src ? (
                                    <Tile key={idx} label={`Item ${itemId}`} src={src} className={`h-10 w-10 !rounded-lg ${idx === 6 ? '!rounded-full border-amber-400/50' : ''}`} />
                                ) : (
                                    <div key={idx} className={`h-10 w-10 border border-white/[0.08] bg-white/[0.02] ${idx === 6 ? 'rounded-full' : 'rounded-lg'}`} />
                                );
                            })}
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
                             onClick={() => { navigate(`/champions/${encodeURIComponent(player.champ)}`); onClose(); }}
                             title={`Mergi la pagina campionului ${player.champ}`}>
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
                                      onClick={() => { navigate(`/champions/${encodeURIComponent(player.champ)}`); onClose(); }}
                                      title={`Mergi la pagina campionului ${player.champ}`}>
                                    {player.champ}
                                </span>
                                <span>·</span>
                                <span className="font-medium text-amber-300">{player.rank}</span>
                                <span>·</span>
                                <span className="text-white/85 font-medium">Pagina Completă de Rune</span>
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
                        {/* Tree Header */}
                        <div className="flex items-center gap-2.5 border-b border-white/10 pb-2.5">
                            <img src={STYLE_ICONS[runePage.primaryStyle]} alt={runePage.primaryStyle} className="h-7 w-7 object-contain" />
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Calea Principală</span>
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
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Runa Cheie (Keystone)</span>
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
                        {/* Secondary Tree */}
                        <div className={`rounded-2xl border ${secColor.border} ${secColor.bg} p-4.5 space-y-3`}>
                            {/* Secondary Header */}
                            <div className="flex items-center gap-2.5 border-b border-white/10 pb-2">
                                <img src={STYLE_ICONS[runePage.secondaryStyle]} alt={runePage.secondaryStyle} className="h-6 w-6 object-contain" />
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Calea Secundară</span>
                                    <h4 className={`text-sm font-bold ${secColor.text}`}>{runePage.secondaryStyle}</h4>
                                </div>
                            </div>

                            {/* Secondary Runes */}
                            <div className="space-y-2">
                                {runePage.secondaryRunes.map((runeName, idx) => (
                                    <div key={idx} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/50 border border-white/15">
                                            <img src={ALL_RUNE_ICONS[runeName] || RUNE_ICONS.Conqueror} alt={runeName} className="h-5 w-5 object-contain" />
                                        </div>
                                        <div>
                                            <span className="text-[9px] uppercase tracking-wider text-white/40">Secundar {idx + 1}</span>
                                            <p className="text-xs font-semibold text-white/90">{runeName}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Stat Shards */}
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 block">Fragmente de Statistici (Shards)</span>
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
                    <button onClick={() => { navigate(`/champions/${encodeURIComponent(player.champ)}`); onClose(); }}
                            className="flex items-center gap-2 text-xs font-semibold text-accent hover:underline">
                        <Sparkles size={14} /> Vezi toate build-urile și runele populare pe {player.champ}
                    </button>
                    <button onClick={onClose}
                            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition">
                        Închide
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function LiveGame({ summoner, onSearch, onNavigate }) {
    const [searchName, setSearchName] = useState('');
    const [region, setRegion] = useState(summoner?.region || 'EUW');
    const [assets, setAssets] = useState(null);
    const [inspectingPlayer, setInspectingPlayer] = useState(null);
    const [inspectingRunePlayer, setInspectingRunePlayer] = useState(null);

    // ── Real Backend Live Game State ──
    const [userMatch, setUserMatch] = useState(null);
    const [loadingUserMatch, setLoadingUserMatch] = useState(false);
    const [userMatchChecked, setUserMatchChecked] = useState(false);

    // ── Real Featured Apex Matches from Backend ──
    const [featuredMatches, setFeaturedMatches] = useState([]);
    const [loadingFeatured, setLoadingFeatured] = useState(false);
    const [selectedFeaturedMatch, setSelectedFeaturedMatch] = useState(null);

    useEffect(() => {
        loadAssets().then(setAssets).catch(() => {});
    }, []);

    // Query active game for a given summoner
    const checkLiveGame = async (riotId, reg) => {
        if (!riotId) return;
        setLoadingUserMatch(true);
        setUserMatchChecked(true);
        try {
            const data = await getPlayerLiveGame(riotId, reg || region);
            setUserMatch(data);
            if (data) setSelectedFeaturedMatch(null);
        } catch (err) {
            setUserMatch(null);
        } finally {
            setLoadingUserMatch(false);
        }
    };

    // Auto-check live match when connected summoner changes
    useEffect(() => {
        if (summoner?.name) {
            checkLiveGame(summoner.name, summoner.region);
        }
    }, [summoner]);

    // Load featured live games from backend
    const loadFeatured = (reg) => {
        setLoadingFeatured(true);
        getFeaturedLiveGames(reg || region)
            .then((list) => {
                const arr = list || [];
                setFeaturedMatches(arr);
                if (arr.length > 0 && !selectedFeaturedMatch && !userMatch) {
                    setSelectedFeaturedMatch(arr[0]);
                }
            })
            .catch(() => setFeaturedMatches([]))
            .finally(() => setLoadingFeatured(false));
    };

    useEffect(() => {
        loadFeatured(region);
    }, [region]);

    const currentDisplayMatch = selectedFeaturedMatch || userMatch;

    // ── Keyboard shortcut: press 'P' to toggle detailed build inspect ──
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                setInspectingPlayer((curr) => {
                    if (curr) return null;
                    const m = currentDisplayMatch;
                    const you = m?.blueTeam?.players?.find((p) => p.isYou) || m?.redTeam?.players?.find((p) => p.isYou);
                    return you || m?.blueTeam?.players?.[0] || null;
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentDisplayMatch]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchName.trim()) {
            checkLiveGame(searchName.trim(), region);
        }
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            {/* Page Header */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Radio size={24} className="text-accent animate-pulse" />
                        <h1 className="font-display text-4xl font-bold tracking-tighter drop-shadow-[0_6px_28px_rgba(94,225,255,.3)] sm:text-5xl">
                            <span className="text-shine">Live</span> <span className="text-accent-shine">Game.</span>
                        </h1>
                    </div>
                    <p className="mt-1 text-sm text-white/50">
                        Date în timp real direct din Riot Spectator API via Backend.
                    </p>
                </div>

                {/* Quick Search for any player's live game */}
                <form onSubmit={handleSearch} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1.5 pl-3 focus-within:border-accent/50">
                    <Search size={15} className="text-white/40" />
                    <input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Verifică Riot ID live (Nume#TAG)"
                           className="w-52 bg-transparent text-sm outline-none placeholder:text-white/35" />
                    <RegionSelect value={region} onChange={(r) => { setRegion(r); loadFeatured(r); }} options={REGION_LIST} />
                    <button type="submit" disabled={loadingUserMatch}
                            className="rounded-lg bg-accent/20 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-ink disabled:opacity-50">
                        {loadingUserMatch ? <Loader2 size={14} className="animate-spin" /> : 'Verifică Live'}
                    </button>
                </form>
            </div>

            {/* ── TOP SECTION: User Live Status / Champ Select ── */}
            <div className="mb-8">
                {loadingUserMatch ? (
                    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/[0.04] p-4 text-white">
                        <Loader2 className="animate-spin text-accent shrink-0" size={20} />
                        <div>
                            <p className="text-sm font-semibold">Se interoghează Riot Spectator API...</p>
                            <p className="text-xs text-white/40">Se verifică dacă există un meci activ pe serverul {region}.</p>
                        </div>
                    </div>
                ) : userMatch ? (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5">
                        <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse" />
                            <div>
                                <p className="text-sm font-bold text-white flex items-center gap-2">
                                    {summoner?.name || searchName}
                                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
                                        În Meci Activ ({userMatch.mode || 'Ranked'})
                                    </span>
                                </p>
                                <p className="text-xs text-white/50">
                                    {userMatch.region} · {userMatch.phase === 'champ_select' ? 'Champ Select' : `${Math.floor((userMatch.gameTimeSeconds || 0) / 60)} min în joc`}
                                </p>
                            </div>
                        </div>

                        <button onClick={() => checkLiveGame(summoner?.name || searchName, region)}
                                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition">
                            <RefreshCw size={13} className={loadingUserMatch ? 'animate-spin' : ''} /> Reîmprospătează
                        </button>
                    </div>
                ) : summoner ? (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                        <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-white/40 font-bold">
                                {summoner.name[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white flex items-center gap-2">
                                    {summoner.name}
                                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
                                        Conectat
                                    </span>
                                </p>
                                <p className="text-xs text-white/40">
                                    {userMatchChecked ? 'Nu se află într-un meci activ în acest moment.' : 'Gata de verificare Spectator API.'}
                                </p>
                            </div>
                        </div>

                        <button onClick={() => checkLiveGame(summoner.name, summoner.region)}
                                className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-ink transition">
                            <RefreshCw size={13} className={loadingUserMatch ? 'animate-spin' : ''} /> Verifică Live Game
                        </button>
                    </div>
                ) : (
                    <div className="mb-4 flex items-center justify-between rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-center">
                        <div className="flex items-center gap-3 text-left">
                            <AlertCircle size={20} className="text-accent shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-white">Niciun profil activ căutat</p>
                                <p className="text-xs text-white/45">Introdu un Riot ID (Nume#TAG) în caseta de mai sus pentru a verifica dacă se află în meci live.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* The Main Live Game Board */}
                {currentDisplayMatch ? (
                    <LiveGameView match={currentDisplayMatch}
                                  assets={assets}
                                  onInspectPlayer={setInspectingPlayer}
                                  onInspectRunes={setInspectingRunePlayer} />
                ) : (
                    <Glass className="p-8 text-center border-dashed border-white/15">
                        <Clock size={36} className="mx-auto text-white/20 mb-3" />
                        <h3 className="font-display text-lg font-bold text-white">Așteptare meci live din backend</h3>
                        <p className="text-sm text-white/45 max-w-md mx-auto mt-1">
                            Când un jucător intră într-un meci sau când backend-ul livrează datele de spectator, tabla completă de joc (Champ Select, Build & Rune) va fi afișată aici automat.
                        </p>
                    </Glass>
                )}
            </div>

            {/* ── BOTTOM SECTION: Apex High-ELO Live Matches ── */}
            <div>
                <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div className="flex items-center gap-2">
                        <Shield size={18} className="text-amber-400" />
                        <h2 className="font-display text-lg font-bold text-white tracking-tight">
                            Meciuri Live de Top (Challenger & Grandmaster)
                        </h2>
                    </div>
                    <span className="text-xs text-white/40">
                        {loadingFeatured ? 'Se încarcă meciuri...' : `${featuredMatches.length} meciuri active pe ${region}`}
                    </span>
                </div>

                {loadingFeatured ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="skeleton h-36 rounded-2xl" />
                        <div className="skeleton h-36 rounded-2xl" />
                        <div className="skeleton h-36 rounded-2xl" />
                    </div>
                ) : featuredMatches.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {featuredMatches.map((m, idx) => (
                            <ApexMatchCard key={m.id || idx} match={m}
                                           isSelected={currentDisplayMatch?.id === m.id}
                                           onSelect={() => {
                                               setSelectedFeaturedMatch(m);
                                               window.scrollTo({ top: 0, behavior: 'smooth' });
                                           }} />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                        <p className="text-sm text-white/60">
                            Niciun meci featured primit momentan de la endpoint-ul <code className="text-accent bg-white/10 px-1.5 py-0.5 rounded text-xs">GET /v1/live/featured?region={region}</code>.
                        </p>
                        <p className="text-xs text-white/35 mt-1">
                            Odată ce colegul tău adaugă controller-ul pe backend, meciurile active vor fi preluate automat aici.
                        </p>
                    </div>
                )}
            </div>

            {/* Player Details & Build Modal */}
            {inspectingPlayer && (
                <PlayerModal player={inspectingPlayer}
                             onClose={() => setInspectingPlayer(null)}
                             onInspectRunes={setInspectingRunePlayer}
                             onSearchProfile={(p) => onSearch(`${p.name}#${p.tag}`, region)} />
            )}

            {/* Full Rune Page Modal */}
            {inspectingRunePlayer && (
                <RunePageModal player={inspectingRunePlayer}
                               onClose={() => setInspectingRunePlayer(null)} />
            )}
        </div>
    );
}
