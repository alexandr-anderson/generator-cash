-- DataMigration: backfill Rubric.colors from the owning User.colors
-- Rubrics created before the "default colors from profile" feature have
-- colors = NULL. Fill them once from their owner's profile colors, same
-- rule the app now applies at creation time. Rubrics that already have
-- their own colors, or whose owner has no profile colors set, are left
-- untouched.
UPDATE `Rubric` r
JOIN `User` u ON u.`id` = r.`userId`
SET r.`colors` = u.`colors`
WHERE r.`colors` IS NULL
  AND u.`colors` IS NOT NULL;
