# Real x Orçado — Brasil Paralelo

Sistema web para substituir as planilhas "Real x Orçado" por centro de custo.
Frontend em React + Vite + TypeScript + Tailwind, backend em Supabase (Postgres + Auth + RLS).

## Status atual

- ✅ Schema do banco (ver `schema_real_x_orcado.sql`, já deve ter sido executado no seu projeto Supabase).
- ✅ Autenticação (login por e-mail/senha) com RLS por papel (gestor / fpna_admin).
- ✅ Lista de Centros de Custo do usuário logado.
- ✅ Esqueleto do Dashboard por Centro de Custo (mostra Contas Gerenciais).
- ⏳ Próxima etapa: matriz de Forecast editável + cálculo de Real+Forecast vs Orçado.

## Passo a passo — rodar localmente

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou superior), se ainda não tiver.
2. Nesta pasta, instale as dependências:
   ```bash
   npm install
   ```
3. O arquivo `.env` já vem preenchido com a URL e a chave pública (anon) do seu projeto Supabase.
   **Não delete nem versione esse arquivo com valores reais** — ele já está no `.gitignore`.
4. Rode o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
5. Abra o endereço que aparecer no terminal (geralmente `http://localhost:5173`).

## Antes de conseguir logar: criar um usuário

O Supabase Auth precisa de pelo menos um usuário cadastrado:

1. No painel do Supabase, vá em **Authentication → Users → Add user**.
2. Crie seu usuário com e-mail e senha (marque "Auto Confirm User" para não precisar confirmar por e-mail).
3. Isso vai disparar automaticamente a trigger `handle_new_user`, criando seu `profile` com papel `gestor` por padrão.
4. Para virar `fpna_admin` (acesso a tudo), rode no **SQL Editor**:
   ```sql
   update public.profiles set papel = 'fpna_admin' where email = 'seu-email@brasilparalelo.com.br';
   ```
5. Para aparecer algum Centro de Custo na lista, cadastre pelo menos um em **Table Editor → cost_centers**, e vincule ao seu usuário em `manager_cost_centers` (ou vire `fpna_admin`, que já vê todos).

## Como subir para o GitHub

Se você já criou um repositório vazio em github.com/new, rode dentro desta pasta:

```bash
git init
git add .
git commit -m "Scaffold inicial: auth, RLS, lista de centros de custo"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
git push -u origin main
```

Troque `SEU-USUARIO/NOME-DO-REPO` pelo caminho real do seu repositório.
Se pedir login, use um Personal Access Token do GitHub no lugar da senha (GitHub não aceita mais senha comum em `git push`).

## Deploy (próxima etapa)

Depois do push, conecte o repositório na [Vercel](https://vercel.com/new) ou [Netlify](https://app.netlify.com) —
ambas detectam Vite automaticamente. Configure lá as mesmas variáveis de ambiente do `.env`
(`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) na seção de Environment Variables do projeto.
