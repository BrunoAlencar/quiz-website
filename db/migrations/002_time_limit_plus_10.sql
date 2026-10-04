-- Give every question 10 more seconds and make 30s the default for new ones.
UPDATE questions SET time_limit_seconds = time_limit_seconds + 10;
ALTER TABLE questions ALTER COLUMN time_limit_seconds SET DEFAULT 30;
