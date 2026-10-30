"""Gera lib/lideranca.json a partir da lista de colaboradores e liderança imediata da Gazin.

Uso: python3 scripts/build-lideranca.py caminho/Colaboradores_e_lideranca_imediata_gazin.xlsx

Regras (decididas com a Gazin; nenhuma completa um nome por conta própria):
1. Vale o líder informado na lista (é o documento de liderança imediata). Nos conflitos com a
   planilha de posições críticas, a lista prevalece.
2. Quando a lista não traz um líder utilizável ("#N/A", "0", vazio, nome de cargo, nome incompleto
   não confirmado ou a própria pessoa), usa o gestor da planilha de posições críticas, se houver.
3. Nomes incompletos só são completados quando confirmados (NOMES_CONFIRMADOS).
4. Pessoa repetida: vale a linha que tem líder.
5. Quem não tem líder em nenhuma das fontes fica em "pendentes".
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

# Líder com nome incompleto na lista -> nome completo, confirmado pela Gazin.
NOMES_CONFIRMADOS = {
    "RENAN MEDEIROS": "RENAN DA SILVA MEDEIROS",
    "MARCOS UTSUNOMIYA": "MARCOS ANTONIO UTSUNOMIYA",
}
# Valores da coluna de líder que não identificam uma pessoa.
SEM_LIDER = {"#N/A", "0", "", "NONE", "DATA ENGINEER", "JULIO CESAR", "JULIO CEZAR"}
# Quem não tem líder por ser o topo da estrutura.
TOPO = {"GILMAR ALVES DE OLIVEIRA"}

src = sys.argv[1]
ws = openpyxl.load_workbook(src).active
linhas = []
for i, r in enumerate(ws.iter_rows(values_only=True), start=1):
    colab, lider = (r[1] if len(r) > 1 else None), (r[2] if len(r) > 2 else None)
    if i < 4 or not colab:
        continue
    if lider is None and norm(colab) not in TOPO:
        continue  # anotações no fim da planilha ("Público alvo", etc.): não são pessoas
    linhas.append((i, str(colab), "" if lider is None else str(lider)))

base = json.load(open("lib/base-data.json"))
gestor_posicao = {norm(c["nome"]): c["gestor"] for c in base["chairs"] if c["nome"] and c["gestor"]}

registros, pendentes = {}, {}
for i, colab, lider in linhas:
    k = norm(colab)
    l = NOMES_CONFIRMADOS.get(norm(lider), norm(lider))
    if l in SEM_LIDER or l == k:
        l = ""
    if l:
        origem = "lista com nome confirmado" if norm(lider) in NOMES_CONFIRMADOS else "lista"
        registros[k] = dict(colaborador=title_name(colab), lider=title_name(l), origem=origem, linha=i)
        pendentes.pop(k, None)
    elif k in registros:
        continue  # repetido: já há uma linha com líder
    elif k in TOPO:
        continue
    elif k in gestor_posicao:
        registros[k] = dict(colaborador=title_name(colab), lider=gestor_posicao[k], origem="posições críticas", linha=i,
                            valorNaLista=lider)
    else:
        pendentes[k] = dict(colaborador=title_name(colab), valorNaLista=lider, linha=i)

out = dict(
    fonte="Colaboradores_e_lideranca_imediata_gazin.xlsx",
    registros=sorted(registros.values(), key=lambda r: r["colaborador"]),
    pendentes=sorted(pendentes.values(), key=lambda r: r["colaborador"]),
)
json.dump(out, open("lib/lideranca.json", "w"), ensure_ascii=False, indent=1)

from collections import Counter
print(len(linhas), "linhas;", len(registros), "com líder;", len(pendentes), "pendentes")
print(Counter(r["origem"] for r in registros.values()))
