"""Gera lib/base-data.json a partir de Posicoes_Criticas.xlsx.

Uso: python3 scripts/build-base.py caminho/Posicoes_Criticas.xlsx

Regras de nivel (a planilha nao tem coluna de nivel; ele e derivado do cargo):
- Diretoria: cargo "Diretoria ..." ou "Controller".
- Gerencia Executiva: Gerente que responde ao Presidente OU que tem outro Gerente abaixo dele
  (estendido as demais cadeiras do mesmo cargo, salvo quando o gestor tem o mesmo cargo).
- Gerencia: demais Gerentes.
- Coordenacao: Coordenador / Coord.
- Supervisao: Supervisor / Superv.
- Especialista: demais cargos tecnicos (Administrador de redes/BD, Data Engineer, Tech Lead).
"""
import json, re, sys, unicodedata
import openpyxl

def norm(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().upper()

def title_name(s):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    small = {"DA", "DE", "DO", "DOS", "DAS", "E"}
    return " ".join(w.lower() if w in small else w.capitalize() for w in s.split(" "))

# Nomes por extenso: sem abreviacoes, siglas ou acentos faltando (aplicado a cargo, diretoria e
# cargo do gestor). A chave e comparada sem acento e sem diferenca de maiusculas.
NOME_POR_EXTENSO = {
    "Coord. de projetos e processos": "Coordenador de projetos e processos",
    "Coordenador contabil/tributario": "Coordenador contábil/tributário",
    "Coordenador de SESMT": "Coordenador de segurança e medicina do trabalho",
    "Coordenador transporte": "Coordenador de transporte",
    "Coordenador(a)de pessoal": "Coordenador de pessoal",
    "Diretoria de TI e inovação": "Diretoria de tecnologia da informação e inovação",
    "Diretor de TI e inovação": "Diretor de tecnologia da informação e inovação",
    "Gerente PCP e MRP": "Gerente de planejamento e controle da produção e de necessidade de materiais",
    "Gerente adjunto varejo": "Gerente adjunto de varejo",
    "Gerente admin. industria": "Gerente administrativo da indústria",
    "Gerente administrativo logistica": "Gerente administrativo de logística",
    "Gerente administ.logistica": "Gerente administrativo de logística",
    "Gerente Administrativo (Parceiros de Negócio)": "Gerente administrativo (parceiros de negócio)",
    "Gerente Administrativo Geral": "Gerente administrativo geral",
    "Gerente de Controladoria": "Gerente de controladoria",
    "Administrador de Redes": "Administrador de redes",
    "Gerente assistencia": "Gerente de assistência",
    "Gerente compras": "Gerente de compras",
    "Gerente de PMO": "Gerente do escritório de projetos",
    "Gerente de compras industria": "Gerente de compras da indústria",
    "Gerente de crédito (Atacado,industria)": "Gerente de crédito (atacado e indústria)",
    "Gerente de desenv.de maquinas": "Gerente de desenvolvimento de máquinas",
    "Gerente de neg. internacionais": "Gerente de negócios internacionais",
    "Gerente de operações ecommerce": "Gerente de operações de e-commerce",
    "Gerente fundo de investimento": "Gerente de fundo de investimento",
    "Gerente geral agropecuaria": "Gerente geral agropecuária",
    "Gerente geral de RH": "Gerente geral de recursos humanos",
    "Gerente industria": "Gerente de indústria",
    "Superv. propaganda": "Supervisor de propaganda",
    "Superv.operação tribut.": "Supervisor de operação tributária",
    "Supervisor (a) de e-commerce (atacado)": "Supervisor de e-commerce (atacado)",
    "Supervisor - varejo": "Supervisor de varejo",
    "Supervisor Comercial (Gazinbank)": "Supervisor comercial (Gazin Bank)",
    "Supervisor administrativo (ADM geral)": "Supervisor administrativo (administração geral)",
    "Supervisor de TI": "Supervisor de tecnologia da informação",
    "Supervisor desenvol. Humano": "Supervisor de desenvolvimento humano",
    "Supervisor recrutam. e seleção": "Supervisor de recrutamento e seleção",
}

def por_extenso(s):
    fixed = {norm(k): v for k, v in NOME_POR_EXTENSO.items()}.get(norm(s))
    if fixed:
        return fixed
    if s and s == s.upper() and any(ch.isalpha() for ch in s):
        s = s.lower()  # cargo do gestor em caixa alta na origem: "DIRETOR COMERCIAL" -> "Diretor comercial"
    return s[:1].upper() + s[1:]

# Correcoes de inconsistencias da planilha de origem (grafia do gestor diferente da do ocupante).
# Posicoes que estao vagas embora a planilha de origem traga um ocupante (cargo, ocupante na origem).
# Controller: Fernando Sanches Graci ocupa somente a Diretoria financeira (informado pela Gazin).
VAGA_CORRIGIDA = {("CONTROLLER", "FERNANDO SANCHES GRACI")}
# Cargo do gestor corrigido quando o gestor deixa uma posicao: (gestor, cargo na origem) -> cargo real.
GESTOR_CARGO_FIX = {("FERNANDO SANCHES GRACI", "CONTROLLER"): "Diretor financeiro"}

GESTOR_FIX = {
    "VINICIOS SUZE": "VINICIOS ZUSE",
}

src = sys.argv[1]
ws = openpyxl.load_workbook(src).active
# Posicoes criticas que nao constam da planilha de origem (informadas pela Gazin).
# Vao para o fim da lista para nao renumerar as posicoes existentes.
# (cargo, diretoria/area, ocupante, gestor, cargo do gestor)
POSICOES_ADICIONAIS = [
    ("Gerente geral de RH", "Gerente geral de RH", "ALESSANDRA GUERRA DE SOUZA", "GILMAR ALVES DE OLIVEIRA", "Presidente"),
]

origem = [r[:5] for r in ws.iter_rows(values_only=True, min_row=2) if r[0]] + POSICOES_ADICIONAIS
rows = []
for r in origem:
    cargo, diretoria, ocupante, gestor, gestor_cargo = [re.sub(r"\s+", " ", str(x or "")).strip() for x in r[:5]]
    if gestor_cargo.startswith("="):
        gestor_cargo = ""  # formula quebrada na origem (ex.: "=$A$15"); resolvido abaixo pelo nome do gestor
    cargo, diretoria = por_extenso(cargo), por_extenso(diretoria)
    if norm(gestor_cargo) != "A PREENCHER":
        gestor_cargo = por_extenso(gestor_cargo)
    gestor = GESTOR_FIX.get(norm(gestor), gestor)
    gestor_cargo = GESTOR_CARGO_FIX.get((norm(gestor), norm(gestor_cargo)), gestor_cargo)
    vago = norm(ocupante) in ("", "A PREENCHER") or (norm(cargo), norm(ocupante)) in VAGA_CORRIGIDA
    rows.append(dict(cargo=cargo, diretoria=diretoria, ocupante="" if vago else ocupante,
                     gestor="" if norm(gestor) == "A PREENCHER" else gestor,
                     gestorCargo="" if norm(gestor_cargo) == "A PREENCHER" else gestor_cargo, vago=vago))

by_occupant = {}
for r in rows:
    if r["ocupante"]:
        by_occupant.setdefault(norm(r["ocupante"]), []).append(r)

# Cargo do gestor ausente/quebrado: resolve pelo cargo que o gestor ocupa na propria base.
for r in rows:
    if not r["gestorCargo"] and r["gestor"] and norm(r["gestor"]) in by_occupant:
        r["gestorCargo"] = by_occupant[norm(r["gestor"])][0]["cargo"]

def is_gerente(cargo):
    return norm(cargo).startswith("GERENTE")

manages_gerente = set()
for r in rows:
    if is_gerente(r["cargo"]) and r["gestor"]:
        manages_gerente.add(norm(r["gestor"]))

def nivel(r):
    c = norm(r["cargo"])
    if c.startswith("DIRETORIA") or c == "CONTROLLER":
        return "Diretoria"
    if c.startswith("GERENTE"):
        if norm(r["gestorCargo"]) == "PRESIDENTE" or (r["ocupante"] and norm(r["ocupante"]) in manages_gerente):
            return "Gerência Executiva"
        return "Gerência"
    if c.startswith("COORD"):
        return "Coordenação"
    if c.startswith("SUPERV"):
        return "Supervisão"
    return "Especialista"

# Cargo homogeneo: se uma cadeira de um cargo e Gerencia Executiva, as demais cadeiras do mesmo
# cargo tambem sao (ex.: os 8 "Gerente de industria"), exceto quando o gestor dela tem o mesmo
# cargo (ex.: os "Gerente assistencia" subordinados a outro "Gerente assistencia").
exec_cargos = {norm(r["cargo"]) for r in rows if nivel(r) == "Gerência Executiva"}
_nivel_base = nivel
def nivel(r):
    nv = _nivel_base(r)
    if nv == "Gerência" and norm(r["cargo"]) in exec_cargos and norm(r["gestorCargo"]) != norm(r["cargo"]):
        return "Gerência Executiva"
    return nv

cargo_count = {}
for r in rows:
    cargo_count[norm(r["cargo"])] = cargo_count.get(norm(r["cargo"]), 0) + 1

NIVEL_RANK = ["Diretoria", "Gerência Executiva", "Gerência", "Coordenação", "Supervisão", "Especialista"]
chairs, people, person_ids = [], [], {}
for i, r in enumerate(rows, 1):
    cid = f"c{i:03d}"
    nv = nivel(r)
    chairs.append(dict(id=cid, nome=title_name(r["ocupante"]), cargo=r["cargo"], nivel=nv,
                       diretoria=r["diretoria"], cidade="", tempoCasa=None,
                       prefixLocalidade=cargo_count[norm(r["cargo"])] > 1, vago=r["vago"],
                       gestor=title_name(r["gestor"]), gestorCargo=r["gestorCargo"]))
    if r["ocupante"]:
        key = norm(r["ocupante"])
        if key in person_ids:
            # Mesma pessoa em mais de uma cadeira: fica com o nivel mais alto como nivel da pessoa.
            p = next(p for p in people if p["id"] == person_ids[key])
            p["chairIds"].append(cid)
            if NIVEL_RANK.index(nv) < NIVEL_RANK.index(p["nivel"]):
                p.update(nivel=nv, cargo=r["cargo"], diretoria=r["diretoria"], chairId=cid)
            continue
        pid = f"p{len(people) + 1:03d}"
        person_ids[key] = pid
        people.append(dict(id=pid, nome=title_name(r["ocupante"]), nivel=nv, cargo=r["cargo"],
                           diretoria=r["diretoria"], chairId=cid, chairIds=[cid]))

out = dict(source="Posicoes_Criticas.xlsx", chairs=chairs, people=people)
json.dump(out, open("lib/base-data.json", "w"), ensure_ascii=False, indent=1)

from collections import Counter
print(len(chairs), "cadeiras;", len(people), "pessoas;", sum(c["vago"] for c in chairs), "vagas")
print(Counter(c["nivel"] for c in chairs))
for p in people:
    if len(p["chairIds"]) > 1:
        print("multi-cadeira:", p["nome"], p["chairIds"])
