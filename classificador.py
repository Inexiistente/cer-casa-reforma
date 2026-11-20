"""Classificador editorial de setores para o catalogo da CeR Casa e Reforma.

Regras ordenadas por prioridade (desambiguacoes especificas antes de termos gerais)
para evitar falsos positivos comuns em materiais de construcao (ex.: "Cabo Flexivel
Rolo 100m" ir para Ferramentas por causa de "Rolo", ou "Luva Latex" ir para Hidraulica).
"""

from __future__ import annotations

import re
import unicodedata


def norm_txt(s: str) -> str:
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip()


# Cada tupla: (categoria, padrao_regex_compilado)
# A ordem importa: regras especificas de desambiguacao vem primeiro.
_RULES: list[tuple[str, re.Pattern[str]]] = [
    # 1. Desambiguacoes de Seguranca (EPI) — antes de "luva" (Hidraulica) e "bota"
    (
        "Segurança (EPI)",
        re.compile(
            r"\b("
            r"botina|bota\s+(pvc|borracha|seguranca|goma|sete\s+leguas)|"
            r"luva\s+(latex|vaqueta|raspa|pigmentada|nitrilica|procedimento|tato|tatil|malha|pvc|multitato|p/\s*limpeza|seguranca|borracha|algodao)|"
            r"capacete|oculos\s+(seguranca|protecao|ampla)|mascara\s+(pff|descart|respir|solda)|"
            r"protetor\s+(auricular|facial)|abafador|cinto\s+seguranca|avental|cone\s+sinaliz|fita\s+zebrada"
            r")\b"
        ),
    ),
    # 2. Desambiguacoes de Diversos (pneus/camaras de carrinho, sprays automotivos, etc.)
    (
        "Diversos",
        re.compile(
            r"\b("
            r"camara\s+de\s+ar|pneu\b|roda\s+p/\s*carrinho|carrinho\s+de\s+mao|"
            r"desengripante|wd-?40|white\s+lub|silicone\s+automotivo|graxa\b|oleo\s+(singer|lubrif|2t|motor)|"
            r"cabo\s+vassoura|agulha\s+p/\s*fogao|borracha\s+p/\s*panela|"
            r"bateria\s+(alcalina|de\s+litio|9v|12v)|pilha\s+(aa|aaa|alcalina|comum)|"
            r"bomba\s+de\s+encher\s+pneu|bomba\s+inseticida|veneno|raticida|formicida|cupinicida|"
            r"caixa\s+de\s+correio|cx\s+correio|algarismo|numero\s+(residencial|colonial|p/\s*casa)|"
            r"lona\s+(preta|azul|plastica|carreteiro)|bobina\s+de\s+lona|arame\s+farpado|arame\s+galvanizado|"
            r"corda\s+(seda|sisal|nylon|trancada|polipropileno)|vela\s+p/\s*filtro"
            r")\b"
        ),
    ),
    # 3. Desambiguacoes de Casa e Organizacao (antes de "cabo", "balde", "rodo")
    (
        "Casa e Organização",
        re.compile(
            r"\b("
            r"vassoura|rodo\b|pa\s+de\s+lixo|lixeira|cesto\s+de\s+lixo|varal|varao\s+cortina|prendedor\s+roupa|"
            r"escada\s+(aluminio|fibra|domestica|extensivel|abrir)|churrasqueira|grelha\s+churrasq|"
            r"balde\s+(pvc|plastico|graduado)|bacia\s+plastica|regador|pulverizador|borrifador|"
            r"tabua\s+passar|tapete|capacho|organizador|caixa\s+organizadora|gancho\s+adesivo|estante\s+aco"
            r")\b"
        ),
    ),
    # 4. Desambiguacoes de Ferramentas especificas (antes de "cabo", "soquete", "piso", "tinta")
    (
        "Ferramentas",
        re.compile(
            r"\b("
            r"cabo\s+p/\s*(enxada|martelo|marreta|picareta|pa|cavadeira|foice|machado|chibanca|picaret)|"
            r"soquete\s+(magnet\w*|maguinet\w*|sextav\w*|estriado|longo|1/2|3/8|1/4)|jogo\s+soquete|chave\s+soquete|"
            r"alicate\s+para\s+cunha|cortador\s+(de\s+)?(piso|vidro|tubo|vergalhao)|"
            r"batedor\s+para\s+argamassa|desempenadeira|colher\s+(de\s+)?pedreiro|"
            r"estilete|prumo|turquesa|torques|torquesa|aplicador\s+silicone|pistola\s+(silicone|pintura|cola\s+quente)"
            r")\b"
        ),
    ),
    # 5. Desambiguacoes de Tintas & Pintura (antes de "rolo", "cabo", "fita", "lixa")
    (
        "Tintas",
        re.compile(
            r"\b("
            r"tinta\b|esmalte\b|verniz\b|selador\b|fundo\s+preparador|zarcao|batida\s+de\s+pedra|"
            r"massa\s+(corrida|acrilica|pva)|textura\b|grafiato|corante\b|bisnaga\s+corante|"
            r"aguarras|thinner|solvente\b|removedor\b|catalisador|catalisar\s+p/|"
            r"spray\s+(colore|tekbond|comum|aluminio|cromado|dourado|preto|branco|verde|azul|vermelho|amarelo|laranja|cinza|prata|uso\s+geral|alta\s+temp|verniz|primer|fluorescente|metalico)|"
            r"rolo\s+(de\s+)?(la|espuma|anti|pintura|textura|epoxi|p/\s*pintura|p/\s*textura)|"
            r"cabo\s+extensor\s+pintura|bandeja\s+pintura|cacamba\s+pintura|batedor\s+para\s+tinta|"
            r"pincel\b|trincha\b|broxa\b|fita\s+crepe|lixa\s+(massa|parede|madeira|d\.?\s*agua|dagua)"
            r")\b"
        ),
    ),
    # 6. Desambiguacoes de Eletrica e Iluminacao (antes de "rolo", "cabo", "te", "fita", "mangueira", "caixa")
    (
        "Elétrica e Iluminação",
        re.compile(
            r"\b("
            r"cabo\s+(flexivel|coaxial|pp|rigido|de\s+rede|utp|paralelo|p/\s*bateria|solar)|"
            r"fio\s+(flexivel|paralelo|rigido|solido|telef|cobre|esmalte)|"
            r"fita\s+(isolante|auto\s*fusao)|te\s+eletrico|benjamin|adaptador\s+(tomada|2p|3p|padrao)|"
            r"pino\s+(macho|femea|adaptador)|plugue\b|tomada\b|interruptor\b|"
            r"placa\s+(modulare|4x2|4x4|cega|p/\s*tomada|p/\s*interruptor)|modulo\s+(tomada|interruptor|cego|usb|rj45)|"
            r"cx\s+luz|caixa\s+(de\s+)?luz|caixa\s+4x2|caixa\s+4x4|canaleta\s+(sistema|pvc|eletr)|"
            r"mang\.?\s*corrugada|mangueira\s+corrugada|conduite|eletroduto|curva\s+eletroduto|luva\s+eletroduto|"
            r"disjuntor|quadro\s+distrib\w*|barramento\b|dps\b|idr\b|dr\s+bipolar|rele\b|contator|"
            r"conector\s+(wago|torcao|tubular|fio|porcelana|derivacao|sindal|borne|split|bimet)|"
            r"sonda\s+passar|passa\s+fio|terminal\s+(tubular|olhal|forquilha|pre\s*isolado)|"
            r"lampada|luminaria|spot\b|refletor|plafon|arandela|pendente\b|fita\s+led|perfil\s+led|reator\b|starter\b|"
            r"soquete\s+(e27|e40|porcelana|pvc|p/\s*lampada|gu10|t8)|bocal\s+(porcelana|p/\s*lampada|pvc|e27)|"
            r"sensor\s+(de\s+)?presenca|fotocelula|timer\b|campainha|interfone|porteiro\s+eletronico|"
            r"extensao\s+eletrica|filtro\s+de\s+linha|regua\s+tomada|estabilizador|"
            r"resistencia\s+(ducha|chuveiro|p/|fame|lorenzetti|hydra|corona|zagonel|sintex|torneira)|"
            r"antena\s+(interna|externa|digital|uhf|vhf)|divisor\s+antena|conector\s+coaxial"
            r")\b"
        ),
    ),
    # 7. Desambiguacoes de Banheiro e Cozinha (armarios, loucas, torneiras, duchas, assentos)
    (
        "Banheiro e Cozinha",
        re.compile(
            r"\b("
            r"arm\.?\s*(hortencia|iris|tulipa|uni)|armario\s+p/\s*banheiro|gabinete\b|espelheira|espelho\b|"
            r"kit\s+banheiro|barra\s+de\s+apoio|cabide\s+p/\s*toalha|porta\s+toalha|toalheiro|papeleira|saboneteira|"
            r"assento\s+sanit|vaso\s+(sanit|c/)|bacia\s+sanit|caixa\s+acoplada|lavatorio|coluna\s+branca|1/2\s+coluna|"
            r"pia\s+(de|inox|marmore|granito|fibra|aco)|suporte\s+pia|cuba\s+(inox|sobrepor|embutir|apoio|louca)|tanque\s+(1|2|inox|marmore|plastico|pvc|louca)|"
            r"ducha\b|chuveiro\b|braco\s+p/\s*chuveiro|desviador\s+chuveiro|"
            r"torneira|torn\b\.?|"
            r"bica\s+para\s+torneira|bico\s+torn|arejador\b|bucha\s+p/\s*torneira|anel\s+borracha\s+ved.*torn|"
            r"acabamento\s+p/\s*(registro|valv)|volante\s+c-?\d+|"
            r"bolsa\s+p/\s*vaso|anel\s+vedacao\s+p/\s*vaso|reparo\s+(cx|caixa\s+acoplada|valvula\s+descarga|hydra|hidra)|"
            r"valvula\s+(p/\s*(pia|lavatorio|tanque|cuba)|americana)|sifao\b|copo\s+sifao|grelha\s+pia"
            r")\b"
        ),
    ),
    # 8. Argamassas e Rejuntes
    (
        "Argamassas e Rejuntes",
        re.compile(r"\b(argamassa|rejunte|rejuntamento)\b"),
    ),
    # 9. Vedacao e Impermeabilizacao
    (
        "Vedação e Impermeabilização",
        re.compile(
            r"\b("
            r"vedacit|vedapren|sika|bianco|manta\s+(asfaltica|liquida|aluminizada)|impermeabiliz|"
            r"selante\b|silicone\b|pu\s*40|pu40|espuma\s+expansiva|massa\s+(plastica|calafetar|epoxi|vedacao)|"
            r"veda\s+(calha|trinca|tudo|fresta)|fita\s+(asfaltica|aluminizada|multiuso\s+asfalt|dupla\s+face)|"
            r"neutrol|betume|araldite|durepoxi|cola\s+(branca|madeira|contato|instantanea|quente|pva|isopor|tudo)|"
            r"adesivo\s+(de\s+)?(contato|instantaneo|epoxi|selante|montagem)|super\s+bonder|tek\s*bond|alma\s+super"
            r")\b"
        ),
    ),
    # 10. Pisos e Revestimentos
    (
        "Pisos e Revestimentos",
        re.compile(
            r"\b("
            r"piso\b|porcelanato|revestimento\b|ceramica\b|azulejo|pastilha\b|rodape\b|"
            r"nicho\s+porcelanato|espacador|cunha\s+(para|p/|nivelador)|nivelador\s+piso|clip\s+nivelador"
            r")\b"
        ),
    ),
    # 11. Cimento, Blocos e Telhas (Obra Bruta)
    (
        "Cimento, Blocos e Telhas",
        re.compile(
            r"\b("
            r"cimento|areia\b|brita\b|pedrisco|saibro|bloco\s+(010|015|020|concreto|ceramico|vidro)|tijolo|"
            r"telha\b|cumeeira|cal\s+(hidrat|virgem|aditivado|pintura|p/\s*massa)|aglofilito|gesso\s+(em\s+po|cola|rapido|40kg|20kg|1kg)|"
            r"madeirite|tabua\s+(pinus|loja|obra)|caibro|ripa\b|viga\b|"
            r"br\s+de\s+ferro|barra\s+de\s+ferro|vergalhao|trelica|malha\s+pop|coluna\s+armada|estribo|"
            r"arame\s+(recozido|pg-?\d+)"
            r")\b"
        ),
    ),
    # 12. Hidraulica (tubos, conexoes, registros, buchas de reducao, caixas d'agua/gordura/passagem, ralos, calhas, mangueiras)
    (
        "Hidráulica",
        re.compile(
            r"\b("
            r"bucha\s+(de\s+)?reducao|reducao\s+(esgoto|esg|sold|rosc|excentrica|concentrica|\d)|kit\s+copasa|plug\s+(1/2|3/4|1|rosc|sold|pvc|galv|bronze)|"
            r"extensao\s+(cromada|bronze|latao|pvc|p/\s*torneira)|prolongador\b|"
            r"adesivo\s+plastico|cola\s+pvc|solucao\s+limpadora|veda\s+rosca|fita\s+veda|"
            r"tubo\b|cano\b|joelho\b|cotovelo\b|curva\s+(curta|longa|90|45|esg|sold|pvc|rosc)|"
            r"te\s+(20|25|32|40|50|60|75|100|150|1/2|3/4|sold|rosc|esg|reduc|azul|mist|pvc)|"
            r"luva\s+(correr|sold|rosc|esg|reduc|20|25|32|40|50|60|75|100|150|1/2|3/4|1|pvc|galv|azul|lr)|"
            r"registro\b|base\s+p/\s*registro|base\s+para\s+valvula|reparo\s+reg|castelo\s+registro|"
            r"valvula\s+(ret|pe|esfera|descarga|hydra|hidra|bloqueadora)|"
            r"flange\b|adaptador\s+(curto|longo|sold|rosc|p/\s*valvula|caixa|mangueira|filtro)|"
            r"uniao\s+(sold|rosc|pvc|galv|20|25|32|40|50)|niple|nipple|cap\s+(20|25|32|40|50|75|100|1/2|3/4|1|sold|rosc|esg|pvc)|"
            r"boia\b|cx\s+d\.?\s*agua|caixa\s+d'?agua|cx\s+gordura|caixa\s+gordura|cx\s+passagem|caixa\s+passagem|"
            r"cx\s+sifonada|caixa\s+sifonada|ralo\b|grelha\s+(ralo|inox|pvc|aluminio|quadrada|redonda|linear|10|15|20)|"
            r"calha\b|bocal\s+p/\s*calha|cabeceira\s+p/\s*calha|condutor\s+calha|rufo\b|"
            r"engate\s+flex|mang\.?\s*jardim|mangueira\b|anel\s+borracha|tampao\s+(esg|pvc|ferro|caixa)|caixilho\s+ferro"
            r")\b"
        ),
    ),
    # 13. Portas, Janelas e Ferragens
    (
        "Portas, Janelas e Ferragens",
        re.compile(
            r"\b("
            r"fechadura|cadeado|dobradica|trinco|ferrolho|tarjeta|puxador|macaneta|cilindro\s+fechadura|"
            r"basculante|janela|vitro|veneziana|porta\s+(sanfonada|alum\w*|madeira|aco|social|lambril|laminada|prancheta|camarao|pivotante|correr|giro|ferro)|"
            r"alizar|guarnicao|batente|corredica|olho\s+magico|mola\s+aerea|vedaporta|veda\s+porta|"
            r"alavanca\b|roldana|cantoneira|mao\s+francesa|suporte\s+(prateleira|tv|microondas|bicicleta|vaso)|"
            r"corrente\s+(galv|soldada|plastica|cadeado)|mosquetao|esticador|grampo\s+cabo\s+aco|cabo\s+de\s+aco|tela\s+(galv|hexagonal|viveiro|mosquiteiro|sombrite|pinteiro|alambrado)"
            r")\b"
        ),
    ),
    # 14. Parafusos e Fixacao
    (
        "Parafusos e Fixação",
        re.compile(
            r"\b("
            r"parafuso|bucha\s+(fixacao|p/\s*gesso|para\s+tijolo|tijolo|nylon|drywall|grampo|s\d+|6|8|10|12)|"
            r"prego\b|arruelas?\b|porcas?\b|rebite\b|abracadeira|barra\s+rosc|chumbador|"
            r"grampo\s+(p/\s*fio|cerca|fixa|grampeador)|gancho\s+(c/\s*bucha|p/|rede|multiuso|s\b|rosca)|"
            r"pitao|escapula|prisioneiro|pino\s+elastico|pino\s+aco|botao\s+(frances|jacare)"
            r")\b"
        ),
    ),
    # 15. Ferramentas (regra geral)
    (
        "Ferramentas",
        re.compile(
            r"\b("
            r"broca|alicate|chave\s+(de\s+|fenda|phillips|philipps|combinada|boca|estrela|biela|allen|torx|grifo|grinfo|inglesa|ingleza|cano|vela|catraca|teste|mandril|l\b)|"
            r"martelo|marreta|serrote|serra\b|arco\s+de\s+serra|lamina\s+(serra|estilete|tico)|"
            r"disco\s+(de\s+|diam\w*|corte|desbaste|flap|lixa|serra|madeira|porcelanato|concreto)|base\s+disco\s+lixa|"
            r"lixa\b|esponja\s+abrasiva|trena\b|nivel\b|esquadro|metro\s+articulado|paquimetro|"
            r"espatula|raspador|bits\b|ponteira\b|mandril|adaptador\s+sds|"
            r"furadeira|parafusadeira|esmerilhadeira|martelete|lixadeira|plaina|tupia|soprador|compressor|maquina\s+solda|inversora|"
            r"talhadeira|ponteiro|formao|lima\b|grosa\b|sargento|grampo\s+marceneiro|morsa|torno\s+bancada|"
            r"enxada|enxadao|pa\s+(de|bico|quadrada|triangular|ajuntar)|picareta|cavadeira|foice|machado|chibanca|ancinho|rastelo|tesoura\s+(poda|grama|funileiro|chapa|multiuso)|"
            r"linha\s+(pedreiro|nylon\s+pedreiro)|giz\s+de\s+linha|rebitador|grampeador|ferro\s+de\s+solda|solda\s+estanho|eletrodo\b|"
            r"escova\s+de\s+aco|caixa\s+(de\s+)?ferramenta|maleta\s+ferramenta|cinto\s+ferramenta|pedra\s+afiar"
            r")\b"
        ),
    ),
]


def classificar_produto(nome: str) -> str:
    """Retorna o setor correto do produto baseado exclusivamente no nome."""
    n = norm_txt(nome)
    for categoria, pattern in _RULES:
        if pattern.search(n):
            return categoria
    return "Diversos"
