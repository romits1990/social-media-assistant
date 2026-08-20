"use server";

import {
  getSchedules,
  createSchedule,
  toggleScheduleActive,
  deleteSchedule,
  RecurringScheduleEntity,
  CreateScheduleInput,
} from "@/repositories/schedule.repository";
import {
  registerCronTask,
  unregisterCronTask,
  runScheduledPostJob,
} from "@/services/scheduler.service";
import { revalidatePath } from "next/cache";

export type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getSchedulesAction(): Promise<ActionResponse<RecurringScheduleEntity[]>> {
  try {
    const schedules = await getSchedules();
    return { success: true, data: schedules };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch schedules";
    return { success: false, error: message };
  }
}

export async function createScheduleAction(
  input: CreateScheduleInput
): Promise<ActionResponse<RecurringScheduleEntity>> {
  try {
    const newSchedule = await createSchedule(input);
    registerCronTask(newSchedule);
    revalidatePath("/dashboard/schedules");
    return { success: true, data: newSchedule };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create schedule";
    return { success: false, error: message };
  }
}

export async function toggleScheduleAction(
  schedule: RecurringScheduleEntity
): Promise<ActionResponse<boolean>> {
  try {
    const nextStatus = !schedule.isActive;
    await toggleScheduleActive(schedule.id, nextStatus);

    const updatedSchedule: RecurringScheduleEntity = {
      ...schedule,
      isActive: nextStatus,
    };

    if (nextStatus) {
      registerCronTask(updatedSchedule);
    } else {
      unregisterCronTask(schedule.id);
    }

    revalidatePath("/dashboard/schedules");
    return { success: true, data: nextStatus };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to toggle schedule";
    return { success: false, error: message };
  }
}

export async function triggerScheduleNowAction(
  schedule: RecurringScheduleEntity
): Promise<ActionResponse<void>> {
  try {
    await runScheduledPostJob(schedule);
    revalidatePath("/dashboard/posts");
    revalidatePath("/dashboard/schedules");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manual run failed";
    return { success: false, error: message };
  }
}

export async function deleteScheduleAction(id: string): Promise<ActionResponse<void>> {
  try {
    unregisterCronTask(id);
    await deleteSchedule(id);
    revalidatePath("/dashboard/schedules");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete schedule";
    return { success: false, error: message };
  }
}