-- Final backstop against a negative stock balance even if application code
-- has a bug: the app takes a row lock before mutating these counters (see
-- InventoryService), but a DB-level CHECK is what actually guarantees the
-- invariant can never be violated, by any code path, ever.
ALTER TABLE "Inventory"
  ADD CONSTRAINT "available_non_negative" CHECK ("available" >= 0),
  ADD CONSTRAINT "reserved_non_negative" CHECK ("reserved" >= 0);
