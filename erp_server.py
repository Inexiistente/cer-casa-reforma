"""Servidor local da CeR Casa e Reforma com sincronizacao em tempo real com o ERP CentauroCloud.

Reutiliza a configuracao de conta e o fluxo de login do projeto `centauro-sync`
(sem duplicar credenciais) e consulta `/produtos/datatable` em lotes de 1000 itens
para atualizar nomes, unidades, precos de venda e estoque diretamente do ERP.
"""

from __future__ import annotations

import asyncio
import html
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

SITE_DIR = Path(__file__).resolve().parent
CENTAURO_SYNC_DIR = Path(
    os.environ.get(
        "CENTAURO_SYNC_DIR",
        r"c:\Users\Usuario\Desktop\Automacoes Pessoais\Projetos Open Router\centauro-sync",
    )
)

if str(CENTAURO_SYNC_DIR) not in sys.path:
    sys.path.insert(0, str(CENTAURO_SYNC_DIR))

from app.erp._env import aplicar_temp_seguro  # noqa: E402

aplicar_temp_seguro()

from app import storage as erp_storage  # noqa: E402
from app.erp.centauro import CentauroERP  # noqa: E402

from classificador import classificar_produto, norm_txt  # noqa: E402

PRODUTOS_JSON = SITE_DIR / "produtos.json"
PRODUTOS_JS = SITE_DIR / "produtos.js"

# Intervalo minimo (segundos) entre consultas automaticas ao ERP para evitar
# abrir multiplos navegadores seguidos em recarregamentos consecutivos.
MIN_AUTO_SYNC_INTERVAL_S = 30

_TAG_RE = re.compile(r"<[^>]+>")
_PRICE_RE = re.compile(r"[\d.,]+")


def _norm_txt(s: str) -> str:
    return norm_txt(s)


def _classificar_setor(nome: str, mapa_existente: dict[str, str], codigo: str) -> str:
    return classificar_produto(nome)


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


def _carregar_produtos_disco() -> list[dict]:
    if not PRODUTOS_JSON.exists():
        return []
    try:
        return json.loads(PRODUTOS_JSON.read_text(encoding="utf-8"))
    except Exception:
        return []


def _salvar_produtos_disco(produtos: list[dict]) -> None:
    payload_json = json.dumps(produtos, ensure_ascii=False, separators=(",", ":"))
    PRODUTOS_JSON.write_text(payload_json, encoding="utf-8")
    PRODUTOS_JS.write_text(f"window.CER_PRODUCTS={payload_json};\n", encoding="utf-8")


async def buscar_produtos_erp() -> list[dict]:
    """Consulta todos os produtos cadastrados no CentauroCloud via /produtos/datatable."""
    from playwright.async_api import async_playwright

    conta = erp_storage.conta_aberta()
    conta_id = conta["id"] if isinstance(conta, dict) and conta.get("id") else "d68c551c"
    settings = erp_storage.carregar_settings(conta_id)
    erp = CentauroERP(settings, headless=True)

    # Mapa codigo -> setor ja curado no site para manter a organizacao editorial
    existentes = _carregar_produtos_disco()
    mapa_setor = {str(p.get("c", "")).strip(): p.get("g", "Diversos") for p in existentes if p.get("c")}

    cols = ["id_produto", "nome", "codigo_de_barras", "unidade", "quantidade", "arquivo", "valor_de_venda", "id"]
    rows_raw: list[dict] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context()
        context.set_default_timeout(erp.timeout_ms)
        page = await context.new_page()
        try:
            await erp._login(page)
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
                    erp.base_url + "/produtos/datatable",
                    params=params,
                    headers={
                        "X-Requested-With": "XMLHttpRequest",
                        "Referer": erp.base_url + "/produtos",
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
        nome = html.unescape(_TAG_RE.sub("", str(r.get("nome") or ""))).strip()
        nome = re.sub(r"\s+", " ", nome)
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

    produtos.sort(key=lambda x: _norm_txt(x["n"]))
    return produtos


# ------------------------------------------------------------ Estado & API FastAPI

app = FastAPI(title="CeR Casa e Reforma — ERP Live Sync")

_sync_lock = asyncio.Lock()
_state: dict[str, Any] = {
    "sincronizando": False,
    "ultimo_sync_ts": 0.0,
    "atualizado_em": None,
    "erro": None,
    "total": len(_carregar_produtos_disco()),
}


async def _executar_sync(force: bool = False) -> dict[str, Any]:
    now = time.time()
    if not force and _state["ultimo_sync_ts"] and (now - _state["ultimo_sync_ts"]) < MIN_AUTO_SYNC_INTERVAL_S:
        produtos = _carregar_produtos_disco()
        return {
            "origem": "cache_recente",
            "atualizado_em": _state["atualizado_em"],
            "total": len(produtos),
            "produtos": produtos,
        }

    async with _sync_lock:
        # Reconfere apos aguardar o lock caso outra requisicao tenha acabado de sincronizar
        now = time.time()
        if not force and _state["ultimo_sync_ts"] and (now - _state["ultimo_sync_ts"]) < MIN_AUTO_SYNC_INTERVAL_S:
            produtos = _carregar_produtos_disco()
            return {
                "origem": "cache_recente",
                "atualizado_em": _state["atualizado_em"],
                "total": len(produtos),
                "produtos": produtos,
            }

        _state["sincronizando"] = True
        _state["erro"] = None
        try:
            t0 = time.time()
            produtos = await buscar_produtos_erp()
            _salvar_produtos_disco(produtos)
            _state["ultimo_sync_ts"] = time.time()
            _state["atualizado_em"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            _state["total"] = len(produtos)
            print(f"[cer-erp] {len(produtos)} produtos sincronizados do CentauroCloud em {time.time() - t0:.2f}s")
            return {
                "origem": "erp",
                "atualizado_em": _state["atualizado_em"],
                "total": len(produtos),
                "produtos": produtos,
            }
        except Exception as e:
            _state["erro"] = str(e)
            print(f"[cer-erp] erro ao sincronizar: {e}")
            produtos = _carregar_produtos_disco()
            return {
                "origem": "fallback_local",
                "atualizado_em": _state["atualizado_em"],
                "erro": str(e),
                "total": len(produtos),
                "produtos": produtos,
            }
        finally:
            _state["sincronizando"] = False


@app.get("/api/erp/status")
async def erp_status() -> dict[str, Any]:
    return {
        "sincronizando": _state["sincronizando"],
        "atualizado_em": _state["atualizado_em"],
        "total": _state["total"],
        "erro": _state["erro"],
    }


@app.get("/api/produtos")
async def api_produtos(
    sync: bool = Query(default=False, description="Consulta o ERP ao vivo antes de responder"),
    force: bool = Query(default=False, description="Ignora cooldown de 30s e força nova consulta"),
) -> JSONResponse:
    if sync or force:
        res = await _executar_sync(force=force)
        return JSONResponse(res, headers={"Cache-Control": "no-store"})
    produtos = _carregar_produtos_disco()
    return JSONResponse(
        {
            "origem": "local",
            "atualizado_em": _state["atualizado_em"],
            "total": len(produtos),
            "produtos": produtos,
        },
        headers={"Cache-Control": "no-store"},
    )


@app.post("/api/produtos/sync")
async def api_produtos_sync() -> JSONResponse:
    res = await _executar_sync(force=True)
    return JSONResponse(res, headers={"Cache-Control": "no-store"})


# Arquivos estaticos do site (sem cache para refletir edicoes em tempo real)
@app.get("/")
async def index_page() -> FileResponse:
    return FileResponse(SITE_DIR / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/{file_path:path}")
async def static_files(file_path: str):
    alvo = (SITE_DIR / file_path).resolve()
    if not str(alvo).startswith(str(SITE_DIR)) or not alvo.is_file():
        return JSONResponse({"detail": "Arquivo não encontrado"}, status_code=404)
    return FileResponse(alvo, headers={"Cache-Control": "no-store"})


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "4173"))
    print(f"[cer-erp] Servidor CeR Casa e Reforma + ERP Live Sync em http://localhost:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
