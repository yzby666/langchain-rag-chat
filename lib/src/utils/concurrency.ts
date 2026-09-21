type Task<T> = (...args: any[]) => Promise<T>;

/** Run tasks with a concurrency limit, preserving result order. */
export async function concurrency<T = any>(
  tasks: Task<T>[],
  concurrency: number,
): Promise<T[]> {
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    return Promise.reject(
      new Error(`parameter 'concurrency' is not an Integer`),
    );
  }

  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;

      if (index >= tasks.length) {
        return;
      }

      try {
        const data = await tasks[index]();
        results[index] = data;
      } catch (error) {
        results[index] = error;
      }
    }
  }

  const workerCount = Math.min(concurrency, tasks.length);
  return Promise.all(Array.from({ length: workerCount }, () => worker())).then(
    () => results,
  );
}