import { db } from "@/lib/db";

export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type IngestionJob = {
  id: string;
  job_type: "SITEMAP_CRAWL" | "SINGLE_PAGE";
  target_url: string;
  status: JobStatus;
  total_items: number;
  processed_items: number;
  progress_percentage: number;
  error_message: string | null;
  result_data: any;
  created_at: string;
  updated_at: string;
};

export const createJob = async (
  jobType: "SITEMAP_CRAWL" | "SINGLE_PAGE",
  targetUrl: string
): Promise<string> => {
  const query = `
    INSERT INTO ingestion_jobs (job_type, target_url, status)
    VALUES ($1, $2, 'PENDING')
    RETURNING id;
  `;
  const { rows } = await db.query(query, [jobType, targetUrl]);
  return rows[0].id;
};

export const updateJobProgress = async (
  jobId: string,
  data: {
    status?: JobStatus;
    totalItems?: number;
    processedItems?: number;
    progressPercentage?: number;
    errorMessage?: string;
    resultData?: any;
  }
): Promise<void> => {
  const query = `
    UPDATE ingestion_jobs
    SET 
      status = COALESCE($1, status),
      total_items = COALESCE($2, total_items),
      processed_items = COALESCE($3, processed_items),
      progress_percentage = COALESCE($4, progress_percentage),
      error_message = COALESCE($5, error_message),
      result_data = COALESCE($6, result_data),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7;
  `;

  await db.query(query, [
    data.status ?? null,
    data.totalItems ?? null,
    data.processedItems ?? null,
    data.progressPercentage ?? null,
    data.errorMessage ?? null,
    data.resultData ? JSON.stringify(data.resultData) : null,
    jobId,
  ]);
};

export const getJobById = async (jobId: string): Promise<IngestionJob | null> => {
  const query = `SELECT * FROM ingestion_jobs WHERE id = $1;`;
  const { rows } = await db.query(query, [jobId]);
  return rows[0] || null;
};