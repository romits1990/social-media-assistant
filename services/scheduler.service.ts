import cron, { ScheduledTask } from "node-cron";
import { getActiveSchedules, updateScheduleLastRun } from "@/repositories/schedule.repository";
import { socialAssistantGraph } from "@/agents/social.workflow";

// Global registry for in-memory active cron tasks
const scheduledTasksMap = new Map<string, ScheduledTask>();

/**
 * Executes a single schedule tick through the LangGraph agent pipeline
 */
export const runScheduledPostJob = async (scheduleId: string, schedule: {
  target_topic: string;
  platform: any;
  target_domain: string;
  auto_publish: boolean;
}) => {
  console.log(`⏰ [Scheduler] Executing cron job for schedule: "${schedule.target_topic}" on ${schedule.platform}`);

  try {
    const result = await socialAssistantGraph.invoke({
      targetTopic: schedule.target_topic,
      platform: schedule.platform,
      targetDomain: schedule.target_domain !== "ALL" ? schedule.target_domain : undefined,
      autoPublishEnabled: schedule.auto_publish,
      retryCount: 0,
      maxRetries: 3,
      attemptedTopics: [schedule.target_topic],
    });

    await updateScheduleLastRun(scheduleId);
    console.log(`✅ [Scheduler] Completed cron run for schedule ${scheduleId}. Result Status: ${result.status}`);
  } catch (error) {
    console.error(`❌ [Scheduler Error] Failed to execute cron schedule ${scheduleId}:`, error);
  }
};

/**
 * Registers or replaces an active cron job in memory
 */
export const registerCronTask = (schedule: {
  id: string;
  cron_expression: string;
  target_topic: string;
  platform: any;
  target_domain: string;
  auto_publish: boolean;
  is_active: boolean;
}) => {
  // Stop and remove existing running task if it exists
  if (scheduledTasksMap.has(schedule.id)) {
    scheduledTasksMap.get(schedule.id)?.stop();
    scheduledTasksMap.delete(schedule.id);
  }

  if (!schedule.is_active) return;

  if (!cron.validate(schedule.cron_expression)) {
    console.error(`⚠️ [Scheduler] Invalid cron expression "${schedule.cron_expression}" for schedule ${schedule.id}`);
    return;
  }

  const task = cron.schedule(schedule.cron_expression, async () => {
    await runScheduledPostJob(schedule.id, schedule);
  });

  scheduledTasksMap.set(schedule.id, task);
  console.log(`🕒 [Scheduler] Registered active cron "${schedule.cron_expression}" for [${schedule.target_topic}]`);
};

/**
 * Initializes and synchronizes all active database schedules into memory on app boot
 */
export const initializeAllSchedules = async () => {
  try {
    const activeList = await getActiveSchedules();
    console.log(`🚀 [Scheduler] Bootstrapping ${activeList.length} active schedules from database...`);

    // Clear stale in-memory tasks
    scheduledTasksMap.forEach((t) => t.stop());
    scheduledTasksMap.clear();

    for (const schedule of activeList) {
      registerCronTask(schedule);
    }
  } catch (error) {
    console.error("❌ [Scheduler] Initialization error:", error);
  }
};

/**
 * Unregisters a cron task by ID
 */
export const unregisterCronTask = (scheduleId: string) => {
  if (scheduledTasksMap.has(scheduleId)) {
    scheduledTasksMap.get(scheduleId)?.stop();
    scheduledTasksMap.delete(scheduleId);
    console.log(`⏹️ [Scheduler] Unregistered task for schedule ID: ${scheduleId}`);
  }
};