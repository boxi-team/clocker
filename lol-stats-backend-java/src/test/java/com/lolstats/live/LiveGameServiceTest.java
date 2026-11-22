package com.lolstats.live;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.AppException;
import com.lolstats.common.Db;
import com.lolstats.common.ErrorCode;
import com.lolstats.ingest.PlayerRow;
import com.lolstats.ingest.PlayerService;
import com.lolstats.riot.RiotClient;
import com.lolstats.riot.RiotNotFoundException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LiveGameServiceTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private RiotClient riot;
    private PlayerService players;
    private LiveNames names;
    private Db db;
    private LiveGameService service;

    @BeforeEach
    void setUp() {
        riot = mock(RiotClient.class);
        players = mock(PlayerService.class);
        names = mock(LiveNames.class);
        db = mock(Db.class);
        service = new LiveGameService(riot, players, names, db);
    }

    @Test
    void liveGameThrows404WhenPlayerNotInGame() {
        PlayerRow player = new PlayerRow("puuid-1", "euw1", "Caps", "G2", 700, 588, null, null, null);
        when(players.findPlayer("euw1", "Caps", "G2")).thenReturn(player);
        when(riot.activeGame("euw1", "puuid-1")).thenThrow(new RiotNotFoundException("Not in game"));

        AppException ex = assertThrows(AppException.class, () -> service.liveGame("euw1", "Caps", "G2"));
        assertEquals(404, ex.status());
        assertEquals(ErrorCode.NOT_IN_GAME, ex.code());
    }

    @Test
    void liveGameLoadsPlayerFromRiotIfNotInDb() throws Exception {
        when(players.findPlayer("euw1", "Caps", "G2")).thenReturn(null);
        PlayerRow fetched = new PlayerRow("puuid-1", "euw1", "Caps", "G2", 700, 588, null, null, null);
        when(players.fetchAndStorePlayer("euw1", "Caps", "G2")).thenReturn(fetched);
        when(riot.activeGame("euw1", "puuid-1")).thenThrow(new RiotNotFoundException("Not in game"));

        assertThrows(AppException.class, () -> service.liveGame("euw1", "Caps", "G2"));
        verify(players).fetchAndStorePlayer("euw1", "Caps", "G2");
    }

    @Test
    void liveGameReturnsMappedGameWhenActive() throws Exception {
        PlayerRow player = new PlayerRow("puuid-1", "euw1", "Caps", "G2", 700, 588, null, null, null);
        when(players.findPlayer("euw1", "Caps", "G2")).thenReturn(player);

        String activeGameJson = """
        {
          "gameId": 987654321,
          "gameMode": "CLASSIC",
          "gameType": "MATCHED_GAME",
          "gameQueueConfigId": 420,
          "gameStartTime": 1000,
          "gameLength": 600,
          "participants": [
            {
              "puuid": "puuid-1",
              "riotId": "Caps#G2",
              "teamId": 100,
              "championId": 103,
              "spell1Id": 4,
              "spell2Id": 12,
              "perks": { "perkIds": [8010], "perkStyle": 8000, "perkSubStyle": 8400 }
            }
          ],
          "bannedChampions": []
        }
        """;
        when(riot.activeGame("euw1", "puuid-1")).thenReturn(OM.readTree(activeGameJson));
        when(names.get()).thenReturn(new LiveNames.Names("14.23.1",
                Map.of(103, new LiveNames.Champ("Ahri", List.of("Mage"))),
                Map.of(4, "Flash", 12, "Teleport"),
                Map.of(8010, "Conqueror"),
                Map.of(8000, "Precision", 8400, "Resolve")));

        when(riot.leagueEntries("euw1", "puuid-1")).thenReturn(OM.readTree("[]"));

        Map<String, Object> game = service.liveGame("euw1", "Caps", "G2");
        assertNotNull(game);
        assertEquals(987654321L, game.get("gameId"));
        assertEquals("CLASSIC", game.get("gameMode"));
        assertEquals(420, game.get("gameQueueConfigId"));
        assertEquals("Ranked Solo", game.get("mode"));
    }
}
