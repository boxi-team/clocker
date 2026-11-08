package com.lolstats.riot;

public class RiotNotFoundException extends RuntimeException {
    private final String path;

    public RiotNotFoundException(String path) {
        super("Riot 404: " + path);
        this.path = path;
    }

    public String path() { return path; }
}
