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

Pronto! O workflow **Sincronizar Catálogo ERP (CentauroCloud)** vai rodar automaticamente **de hora em hora entre 08h e 19h** (horário de Brasília), e você também pode disparar manualmente a qualquer momento em **Actions → Sincronizar Catálogo ERP → Run workflow**.

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
