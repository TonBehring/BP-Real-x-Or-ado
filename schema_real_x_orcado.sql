-- =====================================================================
-- Real x Orçado — Schema Supabase (Postgres)
-- Brasil Paralelo Educação S.A.
--
-- Como usar:
-- 1. Abra o projeto no Supabase → SQL Editor → New Query
-- 2. Cole este arquivo inteiro e execute (Run)
-- 3. Confirme em Table Editor que as tabelas foram criadas
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSÕES
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- para gen_random_uuid()

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type user_role as enum ('gestor', 'fpna_admin');
create type deviation_class as enum ('economia', 'estouro', 'nao_orcado', 'neutro');
create type entry_origin as enum ('BASE', 'BAIXA_DE_PROVISAO', 'RECLASSIFICACAO', 'MANUAL');

-- ---------------------------------------------------------------------
-- PERFIS DE USUÁRIO
-- Estende auth.users (tabela nativa do Supabase Auth)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  papel user_role not null default 'gestor',
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CENTROS DE CUSTO
-- ---------------------------------------------------------------------
create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,          -- ex: '930600'
  nome text not null,                   -- ex: 'AQUISIÇÃO DE CONTEÚDO'
  diretoria_pai text,                   -- ex: 'Diretoria de Produto'
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Vínculo N:N entre gestores (profiles) e centros de custo
create table public.manager_cost_centers (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cost_center_id uuid not null references public.cost_centers(id) on delete cascade,
  primary key (profile_id, cost_center_id)
);

-- ---------------------------------------------------------------------
-- CONTAS GERENCIAIS
-- ---------------------------------------------------------------------
create table public.managerial_accounts (
  id uuid primary key default gen_random_uuid(),
  cost_center_id uuid not null references public.cost_centers(id) on delete cascade,
  nome text not null,                   -- ex: 'AQUISIÇÃO DE CONTEÚDO - SOFTWARES'
  ordem_exibicao int not null default 0,
  criado_em timestamptz not null default now(),
  unique (cost_center_id, nome)
);

-- ---------------------------------------------------------------------
-- FORNECEDORES (com padronização de nomes alternativos)
-- ---------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  nome_padronizado text not null unique,
  nomes_alternativos text[] not null default '{}',
  criado_em timestamptz not null default now()
);

create index idx_suppliers_alternativos on public.suppliers using gin (nomes_alternativos);

-- ---------------------------------------------------------------------
-- ORÇADO (budget_entries)
-- ---------------------------------------------------------------------
create table public.budget_entries (
  id uuid primary key default gen_random_uuid(),
  cost_center_id uuid not null references public.cost_centers(id) on delete cascade,
  managerial_account_id uuid not null references public.managerial_accounts(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null, -- pode ser nulo (orçado sem fornecedor específico)
  ano int not null,
  mes int not null check (mes between 1 and 12),
  valor numeric(14,2) not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (cost_center_id, managerial_account_id, supplier_id, ano, mes)
);

-- ---------------------------------------------------------------------
-- REALIZADO (actual_entries)
-- ---------------------------------------------------------------------
create table public.actual_entries (
  id uuid primary key default gen_random_uuid(),
  cost_center_id uuid not null references public.cost_centers(id) on delete cascade,
  managerial_account_id uuid not null references public.managerial_accounts(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  valor numeric(14,2) not null default 0,
  data_lancamento date,
  origem entry_origin not null default 'BASE',
  informacao_complementar text,
  projeto text,
  tratamento text not null default 'Utilizar', -- 'Utilizar' | 'Não utilizar' (permite neutralizar lançamento sem apagar)
  criado_em timestamptz not null default now()
);

create index idx_actual_entries_cc_ano_mes on public.actual_entries (cost_center_id, ano, mes);

-- ---------------------------------------------------------------------
-- FORECAST (forecast_entries) — editável só para meses futuros
-- ---------------------------------------------------------------------
create table public.forecast_entries (
  id uuid primary key default gen_random_uuid(),
  cost_center_id uuid not null references public.cost_centers(id) on delete cascade,
  managerial_account_id uuid not null references public.managerial_accounts(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  valor numeric(14,2) not null default 0,
  editado_por uuid references public.profiles(id),
  editado_em timestamptz not null default now(),
  unique (cost_center_id, managerial_account_id, supplier_id, ano, mes)
);

create index idx_forecast_entries_cc_ano_mes on public.forecast_entries (cost_center_id, ano, mes);

-- ---------------------------------------------------------------------
-- JUSTIFICATIVAS DE DESVIO
-- ---------------------------------------------------------------------
create table public.deviation_justifications (
  id uuid primary key default gen_random_uuid(),
  cost_center_id uuid not null references public.cost_centers(id) on delete cascade,
  managerial_account_id uuid not null references public.managerial_accounts(id) on delete cascade,
  ano int not null,
  mes_referencia int check (mes_referencia between 1 and 12), -- nulo = justificativa do ano inteiro
  texto text not null,
  classificacao deviation_class not null default 'neutro',
  autor uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- LOG DE AUDITORIA
-- ---------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  usuario uuid references public.profiles(id),
  entidade text not null,          -- ex: 'forecast_entries'
  entidade_id uuid,
  campo_alterado text,
  valor_anterior text,
  valor_novo text,
  criado_em timestamptz not null default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS)
-- Regra: gestor só vê/edita os centros de custo vinculados a ele.
--        fpna_admin vê/edita tudo.
-- =====================================================================

-- Função auxiliar: papel do usuário logado
create or replace function public.current_user_role()
returns user_role
language sql stable
as $$
  select papel from public.profiles where id = auth.uid();
$$;

-- Função auxiliar: centros de custo do usuário logado
create or replace function public.current_user_cost_centers()
returns setof uuid
language sql stable
as $$
  select cost_center_id from public.manager_cost_centers where profile_id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.cost_centers enable row level security;
alter table public.manager_cost_centers enable row level security;
alter table public.managerial_accounts enable row level security;
alter table public.suppliers enable row level security;
alter table public.budget_entries enable row level security;
alter table public.actual_entries enable row level security;
alter table public.forecast_entries enable row level security;
alter table public.deviation_justifications enable row level security;
alter table public.audit_log enable row level security;

-- profiles: cada um vê o próprio perfil; admin vê todos
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or current_user_role() = 'fpna_admin');

-- cost_centers: admin vê tudo; gestor só os seus
create policy "cost_centers_select" on public.cost_centers
  for select using (
    current_user_role() = 'fpna_admin'
    or id in (select current_user_cost_centers())
  );
create policy "cost_centers_admin_write" on public.cost_centers
  for all using (current_user_role() = 'fpna_admin');

-- managerial_accounts: segue o centro de custo
create policy "managerial_accounts_select" on public.managerial_accounts
  for select using (
    current_user_role() = 'fpna_admin'
    or cost_center_id in (select current_user_cost_centers())
  );
create policy "managerial_accounts_admin_write" on public.managerial_accounts
  for all using (current_user_role() = 'fpna_admin');

-- suppliers: leitura liberada para autenticados; escrita só admin
create policy "suppliers_select_all" on public.suppliers
  for select using (auth.role() = 'authenticated');
create policy "suppliers_admin_write" on public.suppliers
  for all using (current_user_role() = 'fpna_admin');

-- budget_entries: leitura por centro de custo; escrita só admin
create policy "budget_entries_select" on public.budget_entries
  for select using (
    current_user_role() = 'fpna_admin'
    or cost_center_id in (select current_user_cost_centers())
  );
create policy "budget_entries_admin_write" on public.budget_entries
  for all using (current_user_role() = 'fpna_admin');

-- actual_entries: leitura por centro de custo; escrita só admin (via importação)
create policy "actual_entries_select" on public.actual_entries
  for select using (
    current_user_role() = 'fpna_admin'
    or cost_center_id in (select current_user_cost_centers())
  );
create policy "actual_entries_admin_write" on public.actual_entries
  for all using (current_user_role() = 'fpna_admin');

-- forecast_entries: gestor pode ler e escrever no seu centro de custo; admin em tudo
create policy "forecast_entries_select" on public.forecast_entries
  for select using (
    current_user_role() = 'fpna_admin'
    or cost_center_id in (select current_user_cost_centers())
  );
create policy "forecast_entries_gestor_write" on public.forecast_entries
  for insert with check (cost_center_id in (select current_user_cost_centers()));
create policy "forecast_entries_gestor_update" on public.forecast_entries
  for update using (cost_center_id in (select current_user_cost_centers()));
create policy "forecast_entries_admin_all" on public.forecast_entries
  for all using (current_user_role() = 'fpna_admin');

-- deviation_justifications: gestor lê/escreve no seu CC; admin em tudo
create policy "deviation_justifications_select" on public.deviation_justifications
  for select using (
    current_user_role() = 'fpna_admin'
    or cost_center_id in (select current_user_cost_centers())
  );
create policy "deviation_justifications_gestor_write" on public.deviation_justifications
  for insert with check (cost_center_id in (select current_user_cost_centers()));
create policy "deviation_justifications_gestor_update" on public.deviation_justifications
  for update using (cost_center_id in (select current_user_cost_centers()));
create policy "deviation_justifications_admin_all" on public.deviation_justifications
  for all using (current_user_role() = 'fpna_admin');

-- audit_log: só admin lê; sistema escreve via trigger (abaixo)
create policy "audit_log_admin_select" on public.audit_log
  for select using (current_user_role() = 'fpna_admin');

-- =====================================================================
-- TRIGGER DE AUDITORIA (registra alterações em forecast_entries)
-- =====================================================================
create or replace function public.log_forecast_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if (tg_op = 'UPDATE' and old.valor is distinct from new.valor) then
    insert into public.audit_log (usuario, entidade, entidade_id, campo_alterado, valor_anterior, valor_novo)
    values (auth.uid(), 'forecast_entries', new.id, 'valor', old.valor::text, new.valor::text);
  elsif (tg_op = 'INSERT') then
    insert into public.audit_log (usuario, entidade, entidade_id, campo_alterado, valor_anterior, valor_novo)
    values (auth.uid(), 'forecast_entries', new.id, 'valor', null, new.valor::text);
  end if;
  return new;
end;
$$;

create trigger trg_log_forecast_change
  after insert or update on public.forecast_entries
  for each row execute function public.log_forecast_change();

-- =====================================================================
-- TRIGGER: criar profile automaticamente ao cadastrar usuário no Auth
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, nome, email, papel)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email, 'gestor');
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- FIM DO SCHEMA
-- Próximo passo: rodar este script no SQL Editor do Supabase, depois
-- popular cost_centers / managerial_accounts / suppliers com os dados
-- reais dos 13 centros de custo.
-- =====================================================================
