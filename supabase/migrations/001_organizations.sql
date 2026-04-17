-- ============================================================
-- 001_organizations.sql
-- Root isolation unit. Every user belongs to one organization.
-- All other tables reference org_id for RLS tenant isolation.
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at in sync automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Membership join table (owner + invited members)
CREATE TABLE IF NOT EXISTS organization_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at  TIMESTAMPTZ,
  UNIQUE (org_id, user_id)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Users can read their own organizations
CREATE POLICY "Users can read their org"
  ON organizations FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Only owners can update org details
CREATE POLICY "Owners can update their org"
  ON organizations FOR UPDATE
  USING (owner_id = auth.uid());

-- Users can insert (create) an org when they sign up
CREATE POLICY "Authenticated users can create org"
  ON organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Members can read membership records for their org
CREATE POLICY "Members can read org membership"
  ON organization_members FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Only org owners/admins can manage membership
CREATE POLICY "Owners can manage membership"
  ON organization_members FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );
