# Cómo se construye y se publica este sitio

## Estructura

| Carpeta | Qué es |
|---|---|
| `app/index.html` | HTML **fuente**. Es el que se edita. Apunta a `/src/main.js`. |
| `app/src/` | Código fuente (JS, CSS). |
| `public/` | Archivos que se copian tal cual (modelos `.glb`, fuentes, favicon). |
| `dist/` | Salida intermedia de Vite. Ignorada por git. |
| Raíz del repo | **Lo que se publica.** `index.html` + `assets/` aquí son generados, no se editan a mano. |

## Comandos

```
npm run dev     # desarrollo en http://localhost:6001
npm run build   # compila a dist/ y sincroniza dist/* a la raíz
```

## Por qué app/ existe

La raíz del repo es el directorio que publica Hostinger, así que `sync-build.js`
copia `dist/*` a la raíz. Cuando el HTML fuente vivía también en la raíz, cada
build leía el `index.html` ya compilado del build anterior y volvía a hashear sus
assets:

```
index-e8uHRA9b.js -> index-e8uHRA9b-Cq73Ro9v.js -> ...
favicon-ZSjL_fOd.svg -> favicon-ZSjL_fOd-ZSjL_fOd.svg -> ... (7 sufijos)
```

Efectos: se acumularon 9 bundles de ~800 KB en `assets/`, y —más grave— los
cambios en `app/src/` **nunca llegaban a producción**, porque el build reempaquetaba
el bundle viejo en lugar del código fuente.

Separando el HTML fuente en `app/` la entrada del build es siempre el código, y
`sync-build.js` limpia `assets/` en la raíz antes de copiar el build nuevo.

## Regla

No editar `index.html` ni `assets/` de la raíz. Se regeneran con `npm run build`.
