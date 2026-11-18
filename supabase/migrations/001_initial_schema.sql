-- DrowsiGuard — Database Schema Migration
-- =========================================
-- Execute this in Supabase SQL Editor to set up the complete schema.

-- Enables UUID auto-generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('driver', 'manager')) NOT NULL DEFAULT 'driver',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Shifts Table
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_plate TEXT NOT NULL,
  status TEXT CHECK (status IN ('active', 'completed')) DEFAULT 'active',
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ
);

-- 3. Fatigue Events Telemetry Table
CREATE TABLE IF NOT EXISTS fatigue_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT CHECK (event_type IN ('microsleep', 'yawn', 'distraction')) NOT NULL,
  perclos_score FLOAT NOT NULL,
  location_lat FLOAT,
  location_lng FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatigue_events ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════

-- Profiles: Users can read their own profile
CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Profiles: Users can update their own profile
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Profiles: Allow insert for new user registration
CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Managers can read all profiles
CREATE POLICY "Managers read all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Shifts: Drivers can create their own shifts
CREATE POLICY "Drivers create own shifts" ON shifts
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

-- Shifts: Drivers can read their own shifts
CREATE POLICY "Drivers read own shifts" ON shifts
  FOR SELECT USING (auth.uid() = driver_id);

-- Shifts: Drivers can update their own active shifts
CREATE POLICY "Drivers update own shifts" ON shifts
  FOR UPDATE USING (auth.uid() = driver_id);

-- Shifts: Managers can read all shifts
CREATE POLICY "Managers read all shifts" ON shifts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'manager'
    )
  );

-- Fatigue Events: Drivers can insert their own events
CREATE POLICY "Drivers insert own events" ON fatigue_events
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

-- Fatigue Events: Drivers can read their own events
CREATE POLICY "Drivers read own events" ON fatigue_events
  FOR SELECT USING (auth.uid() = driver_id);

-- Fatigue Events: Managers can read all events
CREATE POLICY "Managers read all fatigue events" ON fatigue_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'manager'
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- Supabase Realtime — Enable for fatigue_events
-- ═══════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE fatigue_events;

-- ═══════════════════════════════════════════════════════════════
-- Auth Trigger: Auto-create profile on user signup
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unnamed User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'driver')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- Indexes for performance
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_shifts_driver_id ON shifts(driver_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_fatigue_events_shift_id ON fatigue_events(shift_id);
CREATE INDEX IF NOT EXISTS idx_fatigue_events_driver_id ON fatigue_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_fatigue_events_created_at ON fatigue_events(created_at);
