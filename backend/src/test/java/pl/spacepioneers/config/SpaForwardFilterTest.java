package pl.spacepioneers.config;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class SpaForwardFilterTest {

    @Test
    public void forwardsOnlyFrontendRoutes() {
        assertTrue(SpaForwardFilter.isFrontendRoute("/galaxy"));
        assertTrue(SpaForwardFilter.isFrontendRoute("/alliance/12"));
        assertFalse(SpaForwardFilter.isFrontendRoute("/"));
        assertFalse(SpaForwardFilter.isFrontendRoute("/api/me"));
        assertFalse(SpaForwardFilter.isFrontendRoute("/actuator/health"));
        assertFalse(SpaForwardFilter.isFrontendRoute("/assets/index.js"));
        assertFalse(SpaForwardFilter.isFrontendRoute("/favicon.svg"));
    }
}
