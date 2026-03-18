-- Party view (Phase 2): a single source of truth for partyId parsing/display.
-- partyId is a string key used by FinanceEvent.partyId (e.g. customer:<uuid>, supplier:<uuid>).

CREATE OR REPLACE VIEW "Party" AS
SELECT
  ('customer:' || c."id")::text AS "partyId",
  'customer'::text AS "kind",
  c."id"::text AS "refId",
  c."merchantId"::text AS "merchantId",
  c."name"::text AS "displayName"
FROM "Customer" c
UNION ALL
SELECT
  ('supplier:' || s."id")::text AS "partyId",
  'supplier'::text AS "kind",
  s."id"::text AS "refId",
  s."merchantId"::text AS "merchantId",
  s."name"::text AS "displayName"
FROM "Supplier" s;

