package com.lolstats.ingest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.AppException;
import com.lolstats.common.Db;
import com.lolstats.common.ErrorCode;
import com.lolstats.config.AppProps;
import com.lolstats.riot.RiotClient;
import com.lolstats.riot.RiotNotFoundException;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionTemplate;

class PlayerServiceTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private Db db;
    private RiotClient riot;
    private MatchIngestService matches;
    private AppProps props;
    private TransactionTemplate tx;
    private PlayerService service;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        riot = mock(RiotClient.class);
        matches = mock(MatchIngestService.class);
        props = new AppProps("", "", "", "", "en_US", "", true, true, 2, 0.25, 20, 120, 100, 120,
                false, "euw1", 1000, "", false, "euw1", 100);
        tx = mock(TransactionTemplate.class);

        doAnswer(invocation -> {
            Consumer<?> callback = invocation.getArgument(0);
            callback.accept(null);
            return null;
        }).when(tx).executeWithoutResult(any());

        service = new PlayerService(db, riot, matches, props, tx);
    }

    @Test
    void findPlayerReturnsRowOrNull() {
        when(db.one(contains("FROM players WHERE region = ?"), eq("euw1"), eq("Faker"), eq("KR1"))).thenReturn(null);
        assertNull(service.findPlayer("euw1", "Faker", "KR1"));

        when(db.one(contains("FROM players WHERE region = ?"), eq("kr"), eq("Faker"), eq("KR1"))).thenReturn(Map.of(
                "puuid", "faker-puuid", "region", "kr", "game_name", "Faker", "tag_line", "KR1"));
        PlayerRow player = service.findPlayer("kr", "Faker", "KR1");
        assertNotNull(player);
        assertEquals("faker-puuid", player.puuid());
        assertEquals("Faker", player.gameName());
    }

    @Test
    void getPlayerByPuuidReturnsRowOrNull() {
        when(db.one(contains("FROM players WHERE puuid = ?"), eq("p123"))).thenReturn(Map.of(
                "puuid", "p123", "region", "euw1", "game_name", "Caps", "tag_line", "G2"));
        PlayerRow player = service.getPlayerByPuuid("p123");
        assertNotNull(player);
        assertEquals("Caps", player.gameName());

        when(db.one(contains("FROM players WHERE puuid = ?"), eq("unknown"))).thenReturn(null);
        assertNull(service.getPlayerByPuuid("unknown"));
    }

    @Test
    void fetchAndStorePlayerThrowsWhenRiotReturns404() {
        when(riot.account("euw1", "Ghost", "0000")).thenThrow(new RiotNotFoundException("Not found"));

        AppException ex = assertThrows(AppException.class, () -> service.fetchAndStorePlayer("euw1", "Ghost", "0000"));
        assertEquals(404, ex.status());
        assertEquals(ErrorCode.PLAYER_NOT_FOUND, ex.code());
    }

    @Test
    void fetchAndStorePlayerSuccess() throws Exception {
        when(riot.account("euw1", "Caps", "G2")).thenReturn(OM.readTree("{\"puuid\":\"caps-puuid\",\"gameName\":\"Caps\",\"tagLine\":\"G2\"}"));
        when(riot.summoner("euw1", "caps-puuid")).thenReturn(OM.readTree("{\"summonerLevel\":750,\"profileIconId\":588}"));
        when(riot.leagueEntries("euw1", "caps-puuid")).thenReturn(OM.readTree("[{\"queueType\":\"RANKED_SOLO_5x5\",\"tier\":\"CHALLENGER\",\"rank\":\"I\",\"leaguePoints\":1200,\"wins\":100,\"losses\":50}]"));

        when(db.one(contains("FROM players WHERE puuid = ?"), eq("caps-puuid"))).thenReturn(Map.of(
                "puuid", "caps-puuid", "region", "euw1", "game_name", "Caps", "tag_line", "G2", "summoner_level", 750, "profile_icon_id", 588));

        PlayerRow row = service.fetchAndStorePlayer("euw1", "Caps", "G2");
        assertNotNull(row);
        assertEquals("caps-puuid", row.puuid());
        assertEquals("Caps", row.gameName());

        verify(db, atLeastOnce()).update(contains("INSERT INTO players"), any(), any(), any(), any(), any(), any());
        verify(db, atLeastOnce()).update(contains("INSERT INTO player_ranks"), any(), any(), any(), any(), any(), any(), any());
    }
}
