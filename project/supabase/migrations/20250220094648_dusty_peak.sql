/*
  # Add task history tracking

  1. New Tables
    - `task_history`
      - `id` (uuid, primary key)
      - `taskId` (uuid, references tasks)
      - `userId` (uuid, for future user integration)
      - `action` (text, e.g., 'create', 'update', 'delete')
      - `changes` (json, stores the changes made)
      - `createdAt` (timestamp)

  2. Security
    - Enable RLS on `task_history` table
    - Add policy for authenticated users to read history
*/

CREATE TABLE IF NOT EXISTS task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taskId uuid NOT NULL REFERENCES tasks(id),
  userId uuid,
  action text NOT NULL,
  changes jsonb NOT NULL,
  createdAt timestamptz DEFAULT now()
);

ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read task history"
  ON task_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_task_history_taskid ON task_history(taskId);
CREATE INDEX idx_task_history_createdat ON task_history(createdAt);