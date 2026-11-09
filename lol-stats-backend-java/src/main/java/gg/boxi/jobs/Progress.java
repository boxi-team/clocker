package gg.boxi.jobs;

@FunctionalInterface
public interface Progress {
    void update(int done, int total);
}
