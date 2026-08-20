import cron, { ScheduledTask } from "node-cron";
import {
  getActiveSchedules,
  updateScheduleLastRun,
  RecurringScheduleEntity,
} from "@/repositories/schedule.repository";
import { socialAssistantGraph } from "@/agents/social.workflow";

// In-memory active cron registry mapped by schedule UUID
const scheduledTasksMap = new Map<string, ScheduledTask>();

/**
 * Executes a single scheduled tick through the LangGraph multi-agent pipeline
 */
export const runScheduledPostJob = async (schedule: RecurringScheduleEntity): Promise<void> => {
  console.log(`⏰ [Scheduler] Running schedule "${schedule.name}" for [${schedule.targetTopic}] on ${schedule.platform}`);

  try {
    const result = await socialAssistantGraph.invoke({
      targetTopic: schedule.targetTopic,
      platform: schedule.platform,
      targetDomain: schedule.targetDomain !== "ALL" ? schedule.targetDomain : undefined,
      autoPublishEnabled: schedule.autoPublish,
      retryCount: 0,
      maxRetries: 3,
      attemptedTopics: [schedule.targetTopic],
    });

    await updateScheduleLastRun(schedule.id);
    console.log(`✅ [Scheduler] Completed execution for schedule ${schedule.id}. Status: ${result.status}`);
  } catch (error) {
    console.error(`❌ [Scheduler Error] Execution failed for schedule ${schedule.id}:`, error);
  }
};

/**
 * Unregisters and stops a single cron task from memory
 */
export const unregisterCronTask = (scheduleId: string): void => {
  const existingTask = scheduledTasksMap.get(scheduleId);
  if (existingTask) {
    existingTask.stop();
    scheduledTasksMap.delete(scheduleId);
    console.log(`⏹️ [Scheduler] Unregistered task for schedule ID: ${scheduleId}`);
  }
};

/**
 * Registers or replaces an active cron task in memory
 */
export const registerCronTask = (schedule: RecurringScheduleEntity): void => {
  // Reusable unregister helper ensures zero duplicate timers
  unregisterCronTask(schedule.id);

  if (!schedule.isActive) return;

  if (!cron.validate(schedule.cronExpression)) {
    console.error(`⚠️ [Scheduler] Invalid cron expression "${schedule.cronExpression}" for schedule: ${schedule.id}`);
    return;
  }

  const task = cron.schedule(schedule.cronExpression, async () => {
    await runScheduledPostJob(schedule);
  });

  scheduledTasksMap.set(schedule.id, task);
  console.log(`🕒 [Scheduler] Active cron "${schedule.cronExpression}" registered for [${schedule.targetTopic}]`);
};

/**
 * Robust initializer with auto-retry for Neon DB wake-ups 
 * Synchronizes and bootstraps all active database schedules on server boot
 */
export const initializeAllSchedules = async (retries = 3, delayMs = 2000): Promise<void> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const activeList = await getActiveSchedules();
      console.log(`🚀 [Scheduler] Bootstrapping ${activeList.length} active schedules...`);

      stopAllSchedules();

      for (const schedule of activeList) {
        registerCronTask(schedule);
      }
      return;
    } catch (error) {
      console.warn(`⚠️ [Scheduler] Init attempt ${attempt}/${retries} failed:`, error instanceof Error ? error.message : error);
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        console.error("❌ [Scheduler] Final initialization failed after retries.");
      }
    }
  }
};

/**
 * Graceful shutdown helper: Stops all in-memory cron jobs
 */
export const stopAllSchedules = (): void => {
  console.log(`🛑 [Scheduler] Stopping ${scheduledTasksMap.size} active tasks...`);
  scheduledTasksMap.forEach((task) => task.stop());
  scheduledTasksMap.clear();
  console.log("✅ [Scheduler] All in-memory cron tasks stopped.");
};