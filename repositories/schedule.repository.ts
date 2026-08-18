import { db } from "@/lib/db";
import { SocialPlatform } from "@/agents/agent.state";

export type RecurringScheduleEntity = {
  id: string;
  name: string;
  cron_expression: string;
  platform: SocialPlatform;
  target_topic: string;
  target_domain: string;
  auto_publish: boolean;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export const getSchedules = async (): Promise<RecurringScheduleEntity[]> => {
  const query = `SELECT * FROM recurring_schedules ORDER BY created_at DESC;`;
  const { rows } = await db.query(query);
  return rows;
};

export const getActiveSchedules = async (): Promise<RecurringScheduleEntity[]> => {
  const query = `SELECT * FROM recurring_schedules WHERE is_active = TRUE;`;
  const { rows } = await db.query(query);
  return rows;
};

export const createSchedule = async (data: {
  name: string;
  cron_expression: string;
  platform: SocialPlatform;
  target_topic: string;
  target_domain: string;
  auto_publish: boolean;
}): Promise<RecurringScheduleEntity> => {
  const query = `
    INSERT INTO recurring_schedules (
      name, cron_expression, platform, target_topic, target_domain, auto_publish
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const { rows } = await db.query(query, [
    data.name,
    data.cron_expression,
    data.platform,
    data.target_topic,
    data.target_domain || "ALL",
    data.auto_publish,
  ]);
  return rows[0];
};

export const toggleScheduleActive = async (
  id: string,
  isActive: boolean
): Promise<void> => {
  const query = `
    UPDATE recurring_schedules 
    SET is_active = $2, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $1;
  `;
  await db.query(query, [id, isActive]);
};

export const updateScheduleLastRun = async (id: string): Promise<void> => {
  const query = `
    UPDATE recurring_schedules 
    SET last_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $1;
  `;
  await db.query(query, [id]);
};

export const deleteSchedule = async (id: string): Promise<void> => {
  const query = `DELETE FROM recurring_schedules WHERE id = $1;`;
  await db.query(query, [id]);
};