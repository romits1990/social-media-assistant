"use server";

import {
  getSchedules,
  createSchedule,
  toggleScheduleActive,
  deleteSchedule,
} from "@/repositories/schedule.repository";
import {
  registerCronTask,
  unregisterCronTask,
  runScheduledPostJob,
} from "@/services/scheduler.service";
import { SocialPlatform } from "@/agents/agent.state";
import { revalidatePath } from "next/cache";

export async function getSchedulesAction() {
  try {
    const schedules = await getSchedules();
    return { success: true, schedules };
  } catch (error) {
    return { success: false, error: "Failed to fetch schedules" };
  }
}

export async function createScheduleAction(data: {
  name: string;
  cron_expression: string;
  platform: SocialPlatform;
  target_topic: string;
  target_domain: string;
  auto_publish: boolean;
}) {
  try {
    const newSchedule = await createSchedule(data);
    registerCronTask(newSchedule);
    revalidatePath("/dashboard/schedules");
    return { success: true, schedule: newSchedule };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create schedule";
    return { success: false, error: msg };
  }
}

export async function toggleScheduleAction(id: string, currentStatus: boolean, scheduleData: any) {
  try {
    const newStatus = !currentStatus;
    await toggleScheduleActive(id, newStatus);

    if (newStatus) {
      registerCronTask({ ...scheduleData, id, is_active: true });
    } else {
      unregisterCronTask(id);
    }

    revalidatePath("/dashboard/schedules");
    return { success: true, is_active: newStatus };
  } catch (error) {
    return { success: false, error: "Failed to toggle schedule" };
  }
}

export async function triggerScheduleNowAction(schedule: any) {
  try {
    await runScheduledPostJob(schedule.id, schedule);
    revalidatePath("/dashboard/posts");
    revalidatePath("/dashboard/schedules");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Manual execution failed" };
  }
}

export async function deleteScheduleAction(id: string) {
  try {
    unregisterCronTask(id);
    await deleteSchedule(id);
    revalidatePath("/dashboard/schedules");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete schedule" };
  }
}