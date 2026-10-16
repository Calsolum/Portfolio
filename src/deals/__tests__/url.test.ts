import { describe, expect, it } from "vitest";

import { hostKey, safeHttpUrl, urlKey } from "../lib/url";

describe("safeHttpUrl", () => {
  it("accepts plain http and https links and drops the fragment", () => {
    expect(safeHttpUrl("https://example.com/specials#top")).toBe("https://example.com/specials");
    expect(safeHttpUrl("  http://example.ca  ")).toBe("http://example.ca/");
  });

  it("rejects other schemes, credentials, bare hosts and junk", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>1</script>",
      "ftp://example.com/x",
      "https://user:pw@example.com/",
      "https://localhost/",
      "not a url",
      "",
      "/relative/path",
      42,
      null,
      undefined,
    ]) {
      expect(safeHttpUrl(bad)).toBeUndefined();
    }
  });

  it("rejects absurdly long links", () => {
    expect(safeHttpUrl(`https://example.com/${"a".repeat(2100)}`)).toBeUndefined();
  });
});

describe("urlKey", () => {
  it("ignores scheme, www, a trailing slash, case in the path, the fragment and tracking parameters", () => {
    const a = urlKey("https://www.Example.com/Specials/?utm_source=x&fbclid=y#menu");
    const b = urlKey("http://example.com/specials");
    expect(a).toBe("example.com/specials");
    expect(a).toBe(b);
  });

  it("keeps real query parameters, sorted", () => {
    expect(urlKey("https://example.com/p?b=2&a=1")).toBe("example.com/p?a=1&b=2");
  });

  it("tells different pages apart", () => {
    expect(urlKey("https://example.com/a")).not.toBe(urlKey("https://example.com/b"));
  });

  it("is undefined for anything unsafe", () => {
    expect(urlKey("javascript:alert(1)")).toBeUndefined();
  });
});

describe("hostKey", () => {
  it("drops www", () => {
    expect(hostKey("https://www.wildwing.ca/menu")).toBe("wildwing.ca");
  });
});
