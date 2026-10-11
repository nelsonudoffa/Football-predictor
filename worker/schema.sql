-- Run this SQL against the D1 database bound to the Worker as DB.
CREATE TABLE IF NOT EXISTS fp_users (
  device_id TEXT PRIMARY KEY,
  prediction_count INTEGER NOT NULL DEFAULT 0,
  access_status TEXT NOT NULL DEFAULT 'free' CHECK (access_status IN ('free','pending','approved','rejected')),
  contact_email TEXT,
  contact_name TEXT,
  approved_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fp_payment_requests (
  request_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('OPay','Bank transfer')),
  reference TEXT NOT NULL,
  amount_naira INTEGER NOT NULL DEFAULT 2000,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  FOREIGN KEY(device_id) REFERENCES fp_users(device_id)
);
CREATE INDEX IF NOT EXISTS idx_fp_payment_status_created ON fp_payment_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_fp_payment_device ON fp_payment_requests(device_id);
