-- Alteração na tabela users
ALTER TABLE users 
DROP COLUMN role,
ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

-- Criação da tabela userRoles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Criação da tabela userRoleAssignments
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES user_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Criação da tabela systemPages
CREATE TABLE IF NOT EXISTS system_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Criação da tabela rolePagePermissions
CREATE TABLE IF NOT EXISTS role_page_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES user_roles(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES system_pages(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);