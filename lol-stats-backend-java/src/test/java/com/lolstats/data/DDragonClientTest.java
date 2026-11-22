package com.lolstats.data;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.config.AppProps;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DDragonClientTest {
    private DDragonClient client;

    @BeforeEach
    void setUp() {
        AppProps props = new AppProps("", "", "", "", "en_US", "https://ddragon.leagueoflegends.com",
                true, true, 2, 0.25, 20, 120, 100, 120, false, "euw1", 1000, "", false, "euw1", 100);
        client = new DDragonClient(props, new ObjectMapper());
    }

    @Test
    void urlBuildersConstructValidUrls() {
        assertEquals("https://ddragon.leagueoflegends.com/cdn/14.23.1/img/profileicon/588.png",
                client.profileIconUrl("14.23.1", 588));

        assertEquals("https://ddragon.leagueoflegends.com/cdn/14.23.1/img/champion/Ahri.png",
                client.championImageUrl("14.23.1", "Ahri.png"));

        assertEquals("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg",
                client.splashUrl("Ahri"));

        assertEquals("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_3.jpg",
                client.skinSplashUrl("Ahri", 3));

        assertEquals("https://ddragon.leagueoflegends.com/cdn/14.23.1/img/spell/Flash.png",
                client.spellIconUrl("14.23.1", "Flash.png"));

        assertEquals("https://ddragon.leagueoflegends.com/cdn/14.23.1/img/passive/Ahri_P.png",
                client.passiveIconUrl("14.23.1", "Ahri_P.png"));
    }
}
