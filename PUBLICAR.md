# Publicar `cercasaereforma.com.br` gratuitamente (Cloudflare Pages / GitHub Pages + ERP Automático)

Tudo já está pronto neste diretório (`CNAME`, `sync_erp.py`, `.github/workflows/sync-erp.yml` e metadados SEO/WhatsApp para `https://cercasaereforma.com.br/`).

---

## Passo 1 — Subir o projeto para o GitHub

1. Crie um repositório no GitHub (ex.: `cer-casa-reforma`). Pode ser **público** (GitHub Pages grátis) ou **privado** (Cloudflare Pages grátis).
2. No terminal dentro desta pasta, rode:

```powershell
git init
git add .
git commit -m "feat: site CeR Casa e Reforma com sync automatico do ERP"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/cer-casa-reforma.git
git push -u origin main
```

---

## Passo 2 — Configurar a sincronização automática com o ERP (GitHub Secrets)

No seu repositório no GitHub, vá em **Settings → Secrets and variables → Actions → New repository secret** e crie os 4 segredos abaixo:

| Nome do Secret | Valor |
| :--- | :--- |
| `ERP_URL` | `https://app.centaurocloud.com.br` |
| `ERP_EMPRESA` | `casareforma` |
| `ERP_USER` | *(seu usuário de login do CentauroCloud)* |
| `ERP_PASS` | *(sua senha de login do CentauroCloud)* |

Pronto! O workflow **Sincronizar Catálogo ERP (CentauroCloud)** está configurado para rodar **de 30 em 30 minutos entre 08h e 18h** (horário de Brasília, nos minutos :07 e :37), e você também pode disparar manualmente a qualquer momento em **Actions → Sincronizar Catálogo ERP → Run workflow**.

> **Dica de confiabilidade (100% pontual a cada 30 min):** o agendador nativo (`schedule`) do GitHub Actions funciona em modo *best-effort* e pode atrasar ou pular horários sob carga. Para disparo garantido no minuto exato (08:00, 08:30, ..., 18:00 BRT), crie um agendamento gratuito no [cron-job.org](https://cron-job.org/):
> - **URL:** `https://api.github.com/repos/Inexiistente/cer-casa-reforma/actions/workflows/sync-erp.yml/dispatches`
> - **Método:** `POST`
> - **Headers:** `Accept: application/vnd.github+json`, `Authorization: Bearer SEU_TOKEN_GITHUB`, `Content-Type: application/json`, `X-GitHub-Api-Version: 2022-11-28`
> - **Body:** `{"ref":"main"}`
> - **Horário (America/Sao_Paulo):** minutos `0, 30` · horas `8..18` (ou `0, 30` das `8` às `17` + `0` às `18`).
> - O token é um **Fine-grained Personal Access Token** do GitHub com permissão apenas em `Inexiistente/cer-casa-reforma` → **Actions: Read and write**.

---

## Passo 3 — Publicar gratuitamente no domínio `cercasaereforma.com.br`

### Opção A — Cloudflare Pages (Recomendado: CDN mais rápida + aceita repo privado)
1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com/) → **Workers & Pages → Create → Pages → Connect to Git**.
2. Selecione o repositório `cer-casa-reforma`.
3. Em **Build settings**, deixe **Framework preset: None**, **Build command** em branco e **Build output directory: `/`** → clique em **Save and Deploy**.
4. Em **Custom domains → Set up a custom domain**, digite `cercasaereforma.com.br` (e `www.cercasaereforma.com.br`).
5. Aponte os DNS do domínio `cercasaereforma.com.br` (no Registro.br ou onde registrou) para os nameservers da Cloudflare. O SSL/HTTPS ativa sozinho em poucos minutos.

### Opção B — GitHub Pages (Mais direto ainda, se o repo for público)
1. No GitHub, vá em **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch** → Branch `main` → pasta `/ (root)` → **Save**.
3. O arquivo `CNAME` já configura `cercasaereforma.com.br` automaticamente. Marque **Enforce HTTPS**.
4. No painel DNS do seu domínio (ex.: Registro.br), adicione os registros oficiais do GitHub Pages:
   - **4 registros `A`** (para `cercasaereforma.com.br` / `@`):
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - **1 registro `CNAME`** para `www` apontando para `SEU_USUARIO.github.io`.
