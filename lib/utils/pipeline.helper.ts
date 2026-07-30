import pLimit from 'p-limit';

/**
 * A generic task function that returns a Promise of any type.
 */
type PipelineTask<T = any> = () => Promise<T>;

interface PipelineOptions {
  concurrency: number;
}

/**
 * Executes an array of tasks concurrently up to a specified limit.
 * 
 * @param tasks An array of unexecuted async functions (thunks)
 * @param options Configuration object containing the concurrency limit
 * @returns A promise resolving to an array of results from all tasks
 */
export const executeConcurrentPipeline = async <T>(
  tasks: PipelineTask<T>[],
  options: PipelineOptions
): Promise<T[]> => {
  const { concurrency } = options;

  // 1. Initialise the limiter with the requested count
  const limit = pLimit(concurrency);

  // 2. Wrap each task inside the limit controller
  const limitedTasks = tasks.map((task) => limit(() => task()));

  // 3. Execute all tasks in parallel using the throttling window
  return Promise.all(limitedTasks);
};
