import { db } from "@/lib/db";
import { SocialPlatform } from "@/agents/agent.state";

export type RecurringScheduleEntity = {
  id: string;
  name: string;
  cronExpression: string;
  platform: SocialPlatform;
  targetTopic: string;
  targetDomain: string;
  autoPublish: boolean;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateScheduleInput = {
  name: string;
  cronExpression: string;
  platform: SocialPlatform;
  targetTopic?: string;
  targetDomain?: string;
  autoPublish?: boolean;
};

const SELECT_SCHEDULES_MAPPING = `
  SELECT 
    id,
    name,
    cron_expression AS "cronExpression",
    platform,
    target_topic AS "targetTopic",
    target_domain AS "targetDomain",
    auto_publish AS "autoPublish",
    is_active AS "isActive",
    last_run_at AS "lastRunAt",
    next_run_at AS "nextRunAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM recurring_schedules
`;

export const getSchedules = async (): Promise<RecurringScheduleEntity[]> => {
  const query = `${SELECT_SCHEDULES_MAPPING} ORDER BY created_at DESC;`;
  const { rows } = await db.query<RecurringScheduleEntity>(query);
  return rows;
};

export const getActiveSchedules = async (): Promise<RecurringScheduleEntity[]> => {
  const query = `${SELECT_SCHEDULES_MAPPING} WHERE is_active = TRUE;`;
  const { rows } = await db.query<RecurringScheduleEntity>(query);
  return rows;
};

export const createSchedule = async (
  data: CreateScheduleInput
): Promise<RecurringScheduleEntity> => {
  const query = `
    INSERT INTO recurring_schedules (
      name, cron_expression, platform, target_topic, target_domain, auto_publish
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING 
      id,
      name,
      cron_expression AS "cronExpression",
      platform,
      target_topic AS "targetTopic",
      target_domain AS "targetDomain",
      auto_publish AS "autoPublish",
      is_active AS "isActive",
      last_run_at AS "lastRunAt",
      next_run_at AS "nextRunAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt";
  `;
  const { rows } = await db.query<RecurringScheduleEntity>(query, [
    data.name,
    data.cronExpression,
    data.platform,
    data.targetTopic,
    data.targetDomain || "ALL",
    data.autoPublish ?? false,
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