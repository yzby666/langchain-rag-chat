import { describe, it, expect } from "vitest";
import { concurrency } from "../utils";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("concurrency", () => {
  it("preserves result order across workers", async () => {
    const tasks = [
      async () => {
        await sleep(10);
        return 1;
      },
      async () => 2,
      async () => 3,
    ];

    const results = await concurrency(tasks, 3);

    expect(results).toEqual([1, 2, 3]);
  });

  it("limits the number of concurrently running tasks", async () => {
    let running = 0;
    let maxRunning = 0;

    const tasks = Array.from({ length: 10 }, () => async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await sleep(10);
      running -= 1;
      return 0;
    });

    await concurrency(tasks, 2);

    expect(maxRunning).toBeLessThanOrEqual(2);
  });

  it("captures errors into the result array instead of throwing", async () => {
    const err = new Error("boom");
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject(err),
    ];

    const results: (number | Error)[] = await concurrency<number | Error>(
      tasks,
      2,
    );

    expect(results[0]).toBe(1);
    expect(results[1]).toBe(err);
  });

  it("rejects when concurrency is not a positive integer", async () => {
    await expect(concurrency([async () => 1], 0)).rejects.toThrow();
    await expect(concurrency([async () => 1], 1.5)).rejects.toThrow();
    await expect(concurrency([async () => 1], -1)).rejects.toThrow();
  });

  it("handles an empty task list", async () => {
    const results = await concurrency([], 3);
    expect(results).toEqual([]);
  });
});