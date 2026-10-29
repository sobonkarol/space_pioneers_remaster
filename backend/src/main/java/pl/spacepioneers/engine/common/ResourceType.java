package pl.spacepioneers.engine.common;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum ResourceType {
    METAL, CRYSTAL, TRITIUM;

    @JsonCreator
    public static ResourceType fromJson(String value) {
        return valueOf(value.toUpperCase());
    }
}
