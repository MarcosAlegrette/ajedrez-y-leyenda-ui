# Ajedrez y Leyendas — versión web

Remake web (React + Vite + TypeScript) de *Ajedrez y Leyendas: El Desafío de Eglerion*, el juego de la XO.
Usa el arte, la música, los sonidos, las voces de las lecciones, los textos y las posiciones **originales** de `../data`.

## Correr

```bash
npm install
npm run prepare-game   # genera public/assets y src/data desde ../data (necesita ffmpeg para MP3/MP4)
npm run dev            # http://localhost:5210
```

La API (cuenta de jugador, guardado en la nube y ranking) es opcional: sin ella el juego guarda en el dispositivo.
Por defecto se busca en `http://<host>:8000`; se cambia con `VITE_API_URL` en `.env.local`.

```bash
npm run build          # build de producción en dist/
npm run test:engine    # pruebas del motor de ajedrez (perft) y de las variantes
```

## Cómo está armado

| Carpeta | Qué hay |
|---|---|
| `scripts/build-assets.mjs` | Recorta los rellenos de textura, separa los atlas en sprites y pasa todo a WebP; copia el OGG original y genera MP3 de respaldo; reempaqueta el video a MP4. |
| `scripts/build-data.ts` | PGN de minijuegos y lecciones, textos (`texts.xml`, `tutorialTexts.xml`) y tablas de ELO → JSON. Valida cada línea de solución con el motor. |
| `src/engine` | Motor de ajedrez propio (`chess.ts`), reglas e IA de cada variante (`variants.ts`) y el Web Worker de la IA. |
| `src/game` | Mundo (`world.ts`: 10 áreas, 120 castillos), guardado y cuenta (`store.ts`), ELO original (`elo.ts`), audio y cliente de la API. |
| `src/minigames` | `SoloGame` (laberintos, recolectores, serie blanca…), `PuzzleGame` (jaque mate, táctica…), `VersusGame` (batallas con hechizos y demás enfrentamientos) y `Arcade` (monedas, fantasmas, cazadores). |
| `src/screens`, `src/ui` | Pantallas y componentes (tablero, HUD, diálogos). |

El juego se dibuja en un "escenario" de 800×600 (o 520×900 en vertical) que se escala a la pantalla, igual que el original.

## Qué es reconstrucción

El ejecutable original tenía en el código (no en los datos) la posición de cada castillo en los mapas, qué archivo usa cada
castillo y las reglas finas de cada minijuego. Eso está reconstruido en `src/game/world.ts` y `src/minigames` a partir de los
nombres de los castillos, las lecciones que explican cada desafío y los comentarios de los PGN.

## Publicar en AWS Amplify

El juego es un sitio estático: no necesita servidor ni la API para jugarse.

1. Generar los assets **en tu máquina** (necesita `../data` y ffmpeg) y commitearlos junto con el código:
   `npm run prepare-game` → `public/assets` (~116 MB) y `src/data`. Amplify no puede generarlos.
2. Subir el repositorio a GitHub/GitLab/Bitbucket/CodeCommit y en Amplify Hosting elegir **Deploy an app**.
   - Si el repositorio es sólo esta carpeta, Amplify toma `amplify.yml` y `customHttp.yml` de la raíz.
   - Si el repositorio es todo el workspace (monorepo), marcar **"My app is a monorepo"** con raíz `app`.
     Amplify define `AMPLIFY_MONOREPO_APP_ROOT=app` y usa este mismo `amplify.yml` con `appRoot: app`
     (ver ejemplo abajo).
3. No hace falta regla de rewrite: el juego no usa rutas.
4. (Opcional) Cuando la API esté publicada, agregar la variable de entorno `VITE_API_URL=https://...` y
   volver a desplegar: aparecen "Entrar / Crear jugador" y el ranking. Sin esa variable, la aventura se guarda en
   el navegador de cada jugador.

`amplify.yml` para monorepo (en la raíz del repositorio):

```yaml
version: 1
applications:
  - appRoot: app
    frontend:
      phases:
        preBuild:
          commands: [ 'nvm use 22 || nvm install 22', 'npm ci' ]
        build:
          commands: [ 'npm run build' ]
      artifacts: { baseDirectory: dist, files: [ '**/*' ] }
      cache: { paths: [ 'node_modules/**/*' ] }
```
