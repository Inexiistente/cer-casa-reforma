"""Sincronizador standalone do catalogo CeR Casa e Reforma com o ERP CentauroCloud.

Projetado para rodar tanto no GitHub Actions (via variaveis de ambiente / Secrets)
quanto localmente no PC da loja. Atualiza `produtos.json`, `produtos.js` e
`produtos-meta.json` com precos de venda, nomes, unidades e estoque em tempo real.
"""

from __future__ import annotations

import asyncio
import html
import json
import os
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

SITE_DIR = Path(__file__).resolve().parent
PRODUTOS_JSON = SITE_DIR / "produtos.json"
PRODUTOS_JS = SITE_DIR / "produtos.js"
PRODUTOS_META = SITE_DIR / "produtos-meta.json"

BRT = timezone(timedelta(hours=-3))
_TAG_RE = re.compile(r"<[^>]+>")
_PRICE_RE = re.compile(r"[\d.,]+")

_DEPT_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("Argamassas e Rejuntes", ("argamassa", "rejunte", "impermeabiliz", "vedacit", "bianco", "vedapren", "sika", "manta liquida")),
    ("Cimento, Blocos e Telhas", ("cimento", "areia", "brita", "bloco", "tijolo", "telha", "cal ", "cal hidrat", "vergalhao", "trelica")),
    ("Tintas", ("tinta", "verniz", "selador", "massa corrida", "massa acrilica", "aguarras", "thinner", "solvente", "esmalte", "spray", "textura", "grafiato", "corante", "zarc")),
    ("Hidráulica", ("tubo", "cano", "joelho", "cotovelo", "te sold", "luva ", "registro", "valvula", "sifao", "ralo", "caixa d'agua", "caixa dagua", "boia", "calha", "anel borracha", "fita veda", "adaptador", "nipple", "niple", "engate", "flange", "cap ", "plug ")),
    ("Elétrica e Iluminação", ("cabo flex", "fio ", "disjuntor", "tomada", "interruptor", "lampada", "led", "eletroduto", "conduite", "fita isolante", "quadro distrib", "plugue", "benjamin", "extensao", "luminaria", "spot ", "refletor", "sensor presenca", "campainha", "chuveiro", "resistencia")),
    ("Banheiro e Cozinha", ("torneira", "ducha", "vaso sanit", "assento sanit", "lavatorio", "cuba", "pia ", "tanque", "armario p/ banheiro", "espelheira", "acabamento p/ registro", "acabamento p/ valv", "bica para torneira", "saboneteira", "papeleira", "toalheiro", "caixa acoplada")),
    ("Portas, Janelas e Ferragens", ("fechadura", "cadeado", "dobradica", "trinco", "ferrolho", "puxador", "basculante", "janela", "porta ", "alizar", "guarnicao", "corredica", "macaneta", "olho magico", "mola aerea", "alavanca")),
    ("Parafusos e Fixação", ("parafuso", "bucha ", "prego", "arruela", "porca", "rebite", "abracadeira", "barra rosc", "chumbador", "grampo", "gancho", "pitão", "pitao", "escápula", "escapula")),
    ("Segurança (EPI)", ("botina", "bota ", "luva ", "capacete", "oculos", "mascara", "protetor auricular", "cinto seguranca", "epi", "avental")),
    ("Pisos e Revestimentos", ("piso ", "porcelanato", "ceramica", "revestimento", "rodape", "espacador", "cunha", "nivelador")),
    ("Ferramentas", ("broca", "alicate", "chave ", "martelo", "marreta", "serrote", "serra", "disco ", "lixa", "trena", "nivel", "esquadro", "colher pedreiro", "desempenadeira", "espátula", "espatula", "rolo ", "pincel", "trincha", "broxa", "arco de serra", "aplicador", "bits", "furadeira", "esmerilhadeira", "talhadeira", "ponteiro", "enxada", "pa ", "picareta", "cavadeira", "estilete", "tesoura")),
]


def _norm_txt(s: str) -> str:
    s = unicodedata.normalize("NFKD", (s or "").lower())
    return "".join(c for c in s if not unicodedata.combining(c))


def _classificar_setor(nome: str, mapa_existente: dict[str, str], codigo: str) -> str:
    if codigo and codigo in mapa_existente:
        return mapa_existente[codigo]
    n = _norm_txt(nome)
    for setor, palavras in _DEPT_RULES:
        if any(p in n for p in palavras):
            return setor
    return "Diversos"


def _parse_br_float(raw: Any) -> float:
    if raw is None:
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw)
    txt = html.unescape(_TAG_RE.sub(" ", str(raw))).strip()
    m = _PRICE_RE.search(txt)
    if not m:
        return 0.0
    num = m.group(0)
    if "," in num and "." in num:
        num = num.replace(".", "").replace(",", ".")
    elif "," in num:
        num = num.replace(",", ".")
    try:
        return float(num)
    except ValueError:
        return 0.0


def _carregar_credenciais() -> tuple[str, str, str, str]:
    base_url = (os.environ.get("ERP_URL") or "https://app.centaurocloud.com.br").strip().rstrip("/")
    empresa = (os.environ.get("ERP_EMPRESA") or "casareforma").strip()
    usuario = (os.environ.get("ERP_USER") or "").strip()
    senha = (os.environ.get("ERP_PASS") or "").strip()

    if not usuario or not senha:
        raise RuntimeError(
            "Configure as variaveis de ambiente ERP_USER e ERP_PASS (e opcionalmente ERP_URL e ERP_EMPRESA)."
        )
    return base_url, empresa, usuario, senha


async def sincronizar() -> int:
    from playwright.async_api import async_playwright

    base_url, empresa, usuario, senha = _carregar_credenciais()

    existentes: list[dict] = []
    if PRODUTOS_JSON.exists():
        try:
            existentes = json.loads(PRODUTOS_JSON.read_text(encoding="utf-8"))
        except Exception:
            existentes = []
    mapa_setor = {str(p.get("c", "")).strip(): p.get("g", "Diversos") for p in existentes if p.get("c")}

    cols = ["id_produto", "nome", "codigo_de_barras", "unidade", "quantidade", "arquivo", "valor_de_venda", "id"]
    rows_raw: list[dict] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context()
        context.set_default_timeout(30000)
        page = await context.new_page()
        try:
            await page.goto(f"{base_url}/login", wait_until="domcontentloaded")
            if empresa:
                await page.fill("#cnpj", empresa)
            await page.fill("#usuario", usuario)
            await page.fill("#senha", senha)
            await page.click("#butao")

            for _ in range(25):
                await page.wait_for_timeout(700)
                if "/login" not in page.url:
                    break
            if "/login" in page.url:
                raise RuntimeError("Falha no login do CentauroCloud (continua em /login).")

            start = 0
            page_size = 1000
            total_records = None

            while True:
                params = {
                    "draw": str((start // page_size) + 1),
                    "start": str(start),
                    "length": str(page_size),
                    "search[value]": "",
                    "search[regex]": "false",
                    "order[0][column]": "0",
                    "order[0][dir]": "asc",
                }
                for i, c in enumerate(cols):
                    params[f"columns[{i}][data]"] = c
                    params[f"columns[{i}][name]"] = ""
                    params[f"columns[{i}][searchable]"] = "true"
                    params[f"columns[{i}][orderable]"] = "true"
                    params[f"columns[{i}][search][value]"] = ""
                    params[f"columns[{i}][search][regex]"] = "false"

                resp = await page.request.get(
                    f"{base_url}/produtos/datatable",
                    params=params,
                    headers={
                        "X-Requested-With": "XMLHttpRequest",
                        "Referer": f"{base_url}/produtos",
                    },
                )
                if resp.status != 200:
                    raise RuntimeError(f"ERP retornou HTTP {resp.status} em /produtos/datatable (start={start})")

                js = await resp.json()
                chunk = js.get("data") or []
                if total_records is None:
                    total_records = int(js.get("recordsTotal") or 0)
                rows_raw.extend(chunk)
                start += len(chunk)
                if not chunk or (total_records and start >= total_records):
                    break
        finally:
            await browser.close()

    produtos: list[dict] = []
    vistos: set[str] = set()
    for r in rows_raw:
        codigo = html.unescape(_TAG_RE.sub("", str(r.get("id_produto") or ""))).strip()
        nome = re.sub(r"\s+", " ", html.unescape(_TAG_RE.sub("", str(r.get("nome") or ""))).strip())
        if not nome:
            continue
        unidade = html.unescape(_TAG_RE.sub("", str(r.get("unidade") or "UN"))).strip().upper() or "UN"
        preco = round(_parse_br_float(r.get("valor_de_venda")), 2)
        estoque = _parse_br_float(r.get("quantidade"))
        if preco <= 0:
            continue
        chave = codigo or nome
        if chave in vistos:
            continue
        vistos.add(chave)
        produtos.append(
            {
                "c": codigo,
                "n": nome,
                "u": unidade,
                "p": preco,
                "s": estoque > 0,
                "g": _classificar_setor(nome, mapa_setor, codigo),
            }
        )

    if len(produtos) < 100:
        raise RuntimeError(f"Retorno inesperado do ERP ({len(produtos)} produtos); abortando para proteger o catalogo.")

    produtos.sort(key=lambda x: _norm_txt(x["n"]))
    payload_json = json.dumps(produtos, ensure_ascii=False, separators=(",", ":"))
    PRODUTOS_JSON.write_text(payload_json, encoding="utf-8")
    PRODUTOS_JS.write_text(f"window.CER_PRODUCTS={payload_json};\n", encoding="utf-8")

    meta = {
        "atualizado_em": datetime.now(BRT).strftime("%d/%m/%Y %H:%M"),
        "total": len(produtos),
    }
    PRODUTOS_META.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    print(f"[sync-erp] OK: {len(produtos)} produtos atualizados em {meta['atualizado_em']}")
    return len(produtos)


if __name__ == "__main__":
    asyncio.run(sincronizar())
