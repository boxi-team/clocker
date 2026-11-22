package com.lolstats.web;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lolstats.common.AppException;
import com.lolstats.common.ErrorCode;
import com.lolstats.common.GlobalExceptionHandler;
import com.lolstats.live.LiveGameService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class LiveControllerTest {
    private LiveGameService live;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        live = mock(LiveGameService.class);
        LiveController controller = new LiveController(live);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void playerLiveReturnsGameData() throws Exception {
        when(live.liveGame("euw1", "Caps", "G2")).thenReturn(Map.of("gameId", 12345L, "mode", "Ranked Solo"));

        mvc.perform(get("/v1/players/euw1/Caps/G2/live"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gameId").value(12345))
                .andExpect(jsonPath("$.data.mode").value("Ranked Solo"));
    }

    @Test
    void playerLiveReturns404WhenNotInGame() throws Exception {
        when(live.liveGame("euw1", "Caps", "G2"))
                .thenThrow(new AppException(404, ErrorCode.NOT_IN_GAME, "Player is not in game"));

        mvc.perform(get("/v1/players/euw1/Caps/G2/live"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_IN_GAME"));
    }

    @Test
    void featuredRejectsInvalidRegion() throws Exception {
        mvc.perform(get("/v1/live/featured").param("region", "INVALID"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"));
    }

    @Test
    void featuredAcceptsValidRegionLabel() throws Exception {
        when(live.featured("euw1")).thenReturn(List.of(Map.of("gameId", 111L)));

        mvc.perform(get("/v1/live/featured").param("region", "EUW"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].gameId").value(111));
    }
}
