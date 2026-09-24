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

# Correcoes de inconsistencias da planilha de origem (grafia do gestor diferente da do ocupante).
GESTOR_FIX = {
    "VINICIOS SUZE": "VINICIOS ZUSE",
}

src = sys.argv[1]
ws = openpyxl.load_workbook(src).active
rows = []
for r in ws.iter_rows(values_only=True, min_row=2):
    if not r[0]:
        continue
    cargo, diretoria, ocupante, gestor, gestor_cargo = [re.sub(r"\s+", " ", str(x or "")).strip() for x in r[:5]]
    if gestor_cargo.startswith("="):
        gestor_cargo = ""  # formula quebrada na origem (ex.: "=$A$15"); resolvido abaixo pelo nome do gestor
    gestor = GESTOR_FIX.get(norm(gestor), gestor)
    vago = norm(ocupante) in ("", "A PREENCHER")
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
