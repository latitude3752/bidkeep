import { describe, expect, it } from "vitest";
import { pipelineHref } from "./pipeline-href";

describe("pipelineHref", () => {
  it("keeps founder links under /admin", () => {
    expect(pipelineHref("/admin/opportunities", { page: "2" })).toBe(
      "/admin/opportunities?page=2"
    );
  });

  it("keeps subscriber links under /app", () => {
    expect(pipelineHref("/app/opportunities", { page: "2" })).toBe(
      "/app/opportunities?page=2"
    );
  });
});
