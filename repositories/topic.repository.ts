import { db } from "@/lib/db";

export const fetchCandidateTopic = async (excludeTopics: string[] = []): Promise<string> => {
    const query = `
    WITH distinct_unposted_topics AS (
      SELECT DISTINCT title, url 
      FROM website_chunks 
      WHERE title IS NOT NULL 
        AND title != ''
        -- Exclude URLs that have already been posted in social_posts
        AND url NOT IN (
            SELECT source_url 
            FROM social_posts 
            WHERE source_url IS NOT NULL
        )
        -- Exclude topics attempted in current execution retry loop
        AND title != ALL($1::text[])
    )
    SELECT title, url 
    FROM distinct_unposted_topics 
    ORDER BY RANDOM() 
    LIMIT 1;
  `;

    const { rows } = await db.query(query, [excludeTopics]);

    if (rows.length === 0) {
        // Fallback topic if all pages have been posted or excluded
        return "Exploring modern web development and digital architecture";
    }

    return rows[0].title;
};