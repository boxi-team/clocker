package com.lolstats.live;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.Domain;
import com.lolstats.live.LiveMapper.AvgTier;
import com.lolstats.live.LiveMapper.Rank;
import com.lolstats.live.LiveNames.Names;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LiveMapperTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private static JsonNode json(String s) throws Exception {
        return OM.readTree(s);
    }

    private static Names names() {
        return new Names("16.22.1",
                Map.of(266, new LiveNames.Champ("Aatrox", List.of("Fighter", "Tank"))),
                Map.of(4, "Flash", 12, "Teleport"),
                Map.of(8010, "Conqueror", 9111, "Triumph", 9104, "Legend: Alacrity", 8299, "Last Stand",
                        8444, "Second Wind", 8451, "Overgrowth"),
                Map.of(8000, "Precision", 8400, "Resolve"));
    }

    @Test
    void parsesRiotId() {
        assertArrayEquals(new String[]{"BrokenBlade", "G2"}, LiveMapper.parseRiotId("BrokenBlade#G2"));
        assertArrayEquals(new String[]{"a#b", "c"}, LiveMapper.parseRiotId("a#b#c"));
        assertArrayEquals(new String[]{"solo", ""}, LiveMapper.parseRiotId("solo"));
        assertArrayEquals(new String[]{"", ""}, LiveMapper.parseRiotId(null));
    }

    @Test
    void modeNames() {
        assertEquals("Ranked Solo", LiveMapper.modeName(420, "CLASSIC"));
        assertEquals("Aram", LiveMapper.modeName(9999, "ARAM"));
        assertEquals("Custom", LiveMapper.modeName(0, ""));
    }

    @Test
    void rankPicksTheQueueOfTheGame() throws Exception {
        JsonNode entries = json("[{\"queueType\":\"RANKED_FLEX_SR\",\"tier\":\"GOLD\",\"leaguePoints\":10,\"wins\":5,\"losses\":5},"
                + "{\"queueType\":\"RANKED_SOLO_5x5\",\"tier\":\"CHALLENGER\",\"leaguePoints\":1250,\"wins\":87,\"losses\":55}]");
        Rank solo = LiveMapper.rankFromEntries(entries, 420);
        assertEquals("Challenger", solo.tier());
        assertEquals(1250, solo.lp());
        assertEquals(142, solo.games());
        assertEquals(61.3, solo.winRate());
        assertEquals("Gold", LiveMapper.rankFromEntries(entries, 440).tier());
        assertEquals(Rank.UNRANKED, LiveMapper.rankFromEntries(json("[]"), 420));
        assertNull(Rank.UNRANKED.winRate());
    }

    @Test
    void averageTierIgnoresUnranked() {
        int challenger = Domain.TIER_BUCKETS.indexOf("challenger");
        AvgTier avg = LiveMapper.avgTier(List.of(
                new Rank(challenger, "Challenger", 1000, 1, 1), new Rank(challenger, "Challenger", 1200, 1, 1), Rank.UNRANKED));
        assertEquals("Challenger", avg.tier());
        assertEquals(1100, avg.avgLp());
        assertNull(LiveMapper.avgTier(List.of(Rank.UNRANKED)).tier());
    }

    @Test
    void buildsRunePageFromPerkIds() throws Exception {
        JsonNode perks = json("{\"perkIds\":[8010,9111,9104,8299,8444,8451,5008,5008,5001],\"perkStyle\":8000,\"perkSubStyle\":8400}");
        Map<String, Object> page = LiveMapper.runePage(perks, names());
        assertEquals("Precision", page.get("primaryStyle"));
        assertEquals("Conqueror", page.get("keystone"));
        assertEquals(List.of("Triumph", "Legend: Alacrity", "Last Stand"), page.get("primaryRunes"));
        assertEquals("Resolve", page.get("secondaryStyle"));
        assertEquals(List.of("Second Wind", "Overgrowth"), page.get("secondaryRunes"));
        assertEquals(List.of("Adaptive Force", "Adaptive Force", "Scaling Health"), page.get("shards"));
        assertNull(LiveMapper.runePage(json("{\"perkIds\":[]}"), names()));
        assertNull(LiveMapper.runePage(json("{}"), names()));
    }

    @Test
    void runePageWithOnlyTheKeystoneKeepsEmptyLists() throws Exception {
        // This is what Riot's spectator API sends today.
        Map<String, Object> page = LiveMapper.runePage(json("{\"perkIds\":[8010],\"perkStyle\":8000,\"perkSubStyle\":8400}"), names());
        assertEquals("Conqueror", page.get("keystone"));
        assertEquals("Precision", page.get("primaryStyle"));
        assertEquals("Resolve", page.get("secondaryStyle"));
        assertEquals(List.of(), page.get("primaryRunes"));
        assertEquals(List.of(), page.get("secondaryRunes"));
        assertEquals(List.of(), page.get("shards"));
    }

    @Test
    void rolesUseSmiteAndChampionClasses() {
        List<List<String>> tags = List.of(
                List.of("Marksman"), List.of("Support"), List.of("Fighter"), List.of("Mage"), List.of("Assassin"));
        List<Boolean> smite = List.of(false, false, false, false, true);
        assertEquals(List.of("adc", "support", "top", "mid", "jungle"), LiveMapper.assignRoles(tags, smite));
    }

    @Test
    void rolesAreNullWhenTeamIsNotFive() {
        List<String> roles = LiveMapper.assignRoles(List.of(List.of("Mage")), List.of(false));
        assertEquals(1, roles.size());
        assertNull(roles.get(0));
    }

    @Test
    void gameSecondsFallsBackToStartTime() throws Exception {
        assertEquals(845, LiveMapper.gameSeconds(json("{\"gameLength\":845}"), 0));
        assertEquals(60, LiveMapper.gameSeconds(json("{\"gameLength\":0,\"gameStartTime\":1000}"), 61_000));
        assertEquals("loading", LiveMapper.phase(json("{\"gameStartTime\":0}")));
        assertEquals("in_game", LiveMapper.phase(json("{\"gameStartTime\":5}")));
    }

    @Test
    void bansListChampionNamesPerTeam() throws Exception {
        JsonNode game = json("{\"bannedChampions\":[{\"championId\":266,\"teamId\":100,\"pickTurn\":1},"
                + "{\"championId\":-1,\"teamId\":100,\"pickTurn\":2},{\"championId\":266,\"teamId\":200,\"pickTurn\":6}]}");
        assertEquals(List.of("Aatrox"), LiveMapper.bans(game, 100, names()));
        assertEquals(List.of("Aatrox"), LiveMapper.bans(game, 200, names()));
    }
}
