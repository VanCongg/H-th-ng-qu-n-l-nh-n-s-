import { SanitizeInputPipe } from "./sanitize-input.pipe";

describe("SanitizeInputPipe", () => {
  it("recursively trims strings and strips script vectors", () => {
    const pipe = new SanitizeInputPipe();
    const result = pipe.transform(
      {
        name: "  Alice  ",
        bio: "Hello<script>alert(1)</script>javascript:alert(2)",
        nested: ["  Bob  ", { note: " javascript:open()" }]
      },
      { type: "body" }
    );

    expect(result).toEqual({
      name: "Alice",
      bio: "Helloalert(2)",
      nested: ["Bob", { note: "open()" }]
    });
  });
});
