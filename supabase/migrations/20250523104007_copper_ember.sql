/*
  # Initial Schema Setup

  1. New Tables
    - `subnets`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `rpc_url` (text)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `subnets` table
    - Add policies for authenticated users to:
      - Read their own subnets
      - Create new subnets
      - Update their own subnets
      - Delete their own subnets
*/

CREATE TABLE IF NOT EXISTS subnets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  rpc_url text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subnets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own subnets"
  ON subnets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subnets"
  ON subnets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subnets"
  ON subnets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subnets"
  ON subnets
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subnets_updated_at
  BEFORE UPDATE ON subnets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();