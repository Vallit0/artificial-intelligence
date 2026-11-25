"""
Convierte las fichas de producto (.docx) de docs/productos-mexico en
src/data/productos.generated.ts para el buscador de productos.

Uso:  python scripts/parse-productos-docx.py

Toma las revisiones 2026 de cada ciudad (Campeche, Mérida, Morelia, Tapachula,
Tuxtla) y la ficha de Perla Océano Guatemala. Ignora las versiones 2023 y la
traducción al inglés de Mérida. Cada ficha sigue el mismo formato:

    NOMBRE: <nombre>
    SEDE / CIUDAD: <ciudad>      CÓDIGO: <código>
    Tipo de producto / Servicio de velación / Alimentos y bebidas / ...

Si cambia el formato de los documentos, ajustar SECTION_HEADERS.
"""
import glob
import json
import os
import re
import sys
import unicodedata
import zipfile
from xml.etree import ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "docs", "productos-mexico")
OUT = os.path.join(ROOT, "src", "data", "productos.generated.ts")

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

# (archivo, país, sede canónica)
SOURCES = [
    ("Productos Campeche (Revisión 2026).docx", "MX", "Campeche"),
    ("Productos Mérida (Revisión 2026).docx", "MX", "Mérida"),
    ("Productos Morelia (Revisión 2026).docx", "MX", "Morelia"),
    ("Productos Tapachula (Revisión 2026).docx", "MX", "Tapachula"),
    ("Productos Tuxtla (Revisión 2026).docx", "MX", "Tuxtla Gutiérrez"),
    ("PERLA OCÉANO GUATEMALA.docx", "GT", "Guatemala"),
]

SECTION_HEADERS = {
    "tipo de producto": "Tipo de producto",
    "servicio de velacion": "Servicio de velación",
    "alimentos y bebidas": "Alimentos y bebidas",
    "servicio de traslado": "Servicio de traslado",
    "servicio de inhumacion": "Servicio de inhumación",
    "servicio para inhumacion": "Servicio de inhumación",
    "servicio de cremacion": "Servicio de cremación",
    "tramites y gestiones legales despues de tener el certificado medico": "Trámites y gestiones legales",
    "homenaje": "Homenaje",
    "propiedad": "Propiedad",
    "beneficios especiales": "Beneficios especiales",
}


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", strip_accents(s).lower().strip().rstrip(":.").strip())


def slug(s: str) -> str:
    s = strip_accents(s).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def docx_lines(path: str):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    lines = []
    for p in root.iter(W + "p"):
        parts = []
        for node in p.iter():
            if node.tag == W + "t" and node.text:
                parts.append(node.text)
            elif node.tag == W + "tab":
                parts.append("\t")
        text = "".join(parts).strip()
        if text:
            lines.append(text)
    return lines


def parse_file(path: str, pais: str, sede: str):
    lines = docx_lines(path)
    products = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("NOMBRE:") and i + 1 < len(lines) and lines[i + 1].startswith("SEDE / CIUDAD"):
            nombre = re.sub(r"\s+", " ", line[len("NOMBRE:"):]).strip()
            header = lines[i + 1]
            m = re.search(r"C[ÓO]DIGO\s*:?\s*(.*)$", header)
            codigo_raw = (m.group(1) if m else "").strip()
            codigo = codigo_raw.strip("()").strip()
            if not codigo or codigo.lower() == "pendiente":
                codigo = None
            sede_raw = re.sub(r"C[ÓO]DIGO.*$", "", header[len("SEDE / CIUDAD"):]).strip(" :\t")
            i += 2
            secciones = []
            current = None

            def push_section(title):
                nonlocal current
                current = {"titulo": title, "items": []}
                secciones.append(current)

            while i < len(lines):
                l = lines[i]
                if l.startswith("NOMBRE:") and i + 1 < len(lines) and lines[i + 1].startswith("SEDE / CIUDAD"):
                    break
                key = norm(l)
                if key in SECTION_HEADERS:
                    title = SECTION_HEADERS[key]
                    # "Propiedad" como VALOR de "Tipo de producto" (fichas de nichos)
                    if title == "Propiedad" and current and current["titulo"] == "Tipo de producto" and not current["items"]:
                        current["items"].append(l.rstrip("."))
                    elif current and current["titulo"] == title:
                        pass  # encabezado repetido (typo del documento)
                    else:
                        push_section(title)
                elif current is not None:
                    current["items"].append(re.sub(r"\s+", " ", l).strip())
                i += 1

            products.append(build_product(nombre, codigo, sede_raw, pais, sede, secciones, os.path.basename(path)))
        else:
            i += 1
    return products


NEGATIVE = re.compile(r"^\s*no\s+(incluye|inlcuye|aplica)", re.I)


def section_items(secciones, titulo):
    for s in secciones:
        if s["titulo"] == titulo:
            return s["items"]
    return []


def includes(secciones, titulo) -> bool:
    items = section_items(secciones, titulo)
    if not items:
        return False
    return not all(NEGATIVE.match(x) for x in items)


def categorize(nombre: str, secciones) -> str:
    n = strip_accents(nombre).upper()
    if any(k in n for k in ("NICHO", "COLUMBARIO", "MEMORIAL")):
        return "Nichos y columbarios"
    if any(k in n for k in ("PERLA", "ARRECIFE")):
        return "Perla memorial y arrecife"
    if "CREMACION" in n and ("FUNERARIO" in n or "CON CREMACION" in n):
        return "Funerario con cremación"
    if "CREMACION" in n:
        return "Cremación"
    if includes(secciones, "Servicio de cremación") and includes(secciones, "Servicio de velación"):
        return "Funerario con cremación"
    return "Servicio funerario"


def tipo_producto(secciones) -> str:
    items = section_items(secciones, "Tipo de producto")
    first = strip_accents(items[0]).lower() if items else ""
    if first.startswith("propiedad y") or ("propiedad" in first and "servicio" in first):
        return "Propiedad y servicio"
    if first.startswith("propiedad"):
        return "Propiedad"
    return "Servicio"


def build_product(nombre, codigo, sede_raw, pais, sede, secciones, fuente):
    pid = slug(f"{pais}-{sede}-{codigo or nombre}")
    return {
        "id": pid,
        "codigo": codigo,
        "nombre": nombre.title().replace("Cremacion", "Cremación").replace("Oceano", "Océano").replace("De ", "de ").replace("En ", "en ").replace("Con ", "con ").replace("No ", "no ").replace("A ", "a "),
        "nombreOriginal": nombre,
        "pais": pais,
        "sede": sede,
        "sedeEnDocumento": sede_raw,
        "tipo": tipo_producto(secciones),
        "categoria": categorize(nombre, secciones),
        "incluyeCremacion": includes(secciones, "Servicio de cremación"),
        "incluyeVelacion": includes(secciones, "Servicio de velación"),
        "incluyeInhumacion": includes(secciones, "Servicio de inhumación"),
        "incluyePropiedad": includes(secciones, "Propiedad"),
        "incluyeHomenaje": includes(secciones, "Homenaje"),
        "secciones": secciones,
        "fuente": fuente,
    }


def main():
    all_products = []
    for fname, pais, sede in SOURCES:
        path = os.path.join(SRC_DIR, fname)
        if not os.path.exists(path):
            print(f"AVISO: no existe {fname}", file=sys.stderr)
            continue
        prods = parse_file(path, pais, sede)
        # Deduplicar fichas repetidas dentro del mismo documento
        seen = set()
        uniq = []
        for p in prods:
            key = (p["nombreOriginal"], p["codigo"])
            if key in seen:
                continue
            seen.add(key)
            # ids únicos aunque el código se repita (p. ej. ARRECIFE y ARRECIFE CORAL comparten CMACOMX001)
            base = p["id"]
            n = 2
            while any(q["id"] == p["id"] for q in uniq + all_products):
                p["id"] = f"{base}-{n}"
                n += 1
            uniq.append(p)
        print(f"{fname}: {len(uniq)} productos")
        all_products.extend(uniq)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    header = (
        "// ARCHIVO GENERADO — no editar a mano.\n"
        "// Fuente: docs/productos-mexico/*.docx  ·  Script: scripts/parse-productos-docx.py\n"
        f"// Productos: {len(all_products)}\n\n"
        'import type { Producto } from "@/lib/productos";\n\n'
        "export const productosGenerados: Producto[] = "
    )
    body = json.dumps(all_products, ensure_ascii=False, indent=2)
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(header + body + ";\n")
    print(f"-> {os.path.relpath(OUT, ROOT)} ({len(all_products)} productos)")


if __name__ == "__main__":
    main()
