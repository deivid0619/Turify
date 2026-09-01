import re, glob, sys

def sin_comentarios(src):
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)      # bloque
    src = re.sub(r'^\s*//.*$', '', src, flags=re.M)      # línea
    src = re.sub(r'\{/\*.*?\*/\}', '', src, flags=re.S)  # comentario JSX
    return src

fallos = 0
for archivo in sorted(glob.glob((sys.argv[1] if len(sys.argv)>1 else '.') + '/*.jsx')):
    bruto = open(archivo, encoding='utf-8').read()
    src = sin_comentarios(bruto)

    disponibles = set()
    # import Algo, { A, B as C } from '...'
    for m in re.finditer(r'^import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from', src, re.M | re.S):
        if m.group(1): disponibles.add(m.group(1))
        if m.group(2):
            for parte in m.group(2).split(','):
                parte = parte.strip()
                if parte: disponibles.add(parte.split(' as ')[-1].strip())
    for m in re.finditer(r'(?:const|let|var|function|class)\s+(\w+)', src):
        disponibles.add(m.group(1))
    for m in re.finditer(r'\{([^}]*)\}\s*=', src):        # desestructuración
        for parte in m.group(1).split(','):
            parte = parte.strip().split(':')[-1].strip()
            if re.fullmatch(r'\w+', parte or ''): disponibles.add(parte)

    usados = set(re.findall(r'<([A-Z]\w+)', src))
    usados |= set(re.findall(r'\b(?:Ico|icon|Componente)\s*:\s*([A-Z]\w+)', src))
    usados -= {'React'}

    faltan = sorted(u for u in usados if u not in disponibles)
    if faltan:
        fallos += len(faltan)
        print(f'  {archivo}: {", ".join(faltan)}')

print('identificadores sin definir:', fallos, '· (0 = la app arranca)')
sys.exit(1 if fallos else 0)
