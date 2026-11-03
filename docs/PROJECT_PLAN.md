Eres un tecnólogo creativo y desarrollador open-source senior. Vas a construir desde cero
"Atlas of Small Weathers", un proyecto de arte generativo open-source. Trabaja de forma autónoma,
sin hacerme preguntas: toma decisiones razonables y déjalas documentadas en /docs/decisions.md.
Código, comentarios y documentación en inglés (el proyecto es para una comunidad global).

## 0. ANTES DE ESCRIBIR CÓDIGO

Lee los SKILL.md de estas skills y aplícalas durante todo el trabajo:

- @algorithmic-art → filosofía generativa: semillas reproducibles, flow fields, parámetros explorables
- @taste-skill + @frontend-design + @impeccable → dirección de arte anti-genérica y UI pulida
- @apple-design + @emil-design-eng → movimiento fluido, física suave, detalles de pulido
- @animation-performance + @animation-vocabulary + @review-animations → tempos, curvas y rendimiento en GPU
- @webapp-testing → verificación con Playwright
- @canvas-design → exportación de pósters y social preview
- @doc-coauthoring → README, CONTRIBUTING y guías
  Resume en 10 líneas (en /docs/art-direction.md) la dirección de arte que sacas de ellas
  antes de empezar.

## 1. FLUJO DE TRABAJO DE SOFTWARE (obligatorio, aplica a todo el proyecto)

Trabaja como en un equipo profesional, aunque seas la única persona.

Repositorio y ramas

- Inicializa git y, si `gh` (GitHub CLI) está disponible y autenticado, crea el repo
  `atlas-of-small-weathers` en GitHub. Si no, deja todo listo en local y documenta los
  comandos en /docs/publishing.md.
- Un único commit inicial en `main` con README mínimo, LICENSE y .gitignore. Después de eso,
  NUNCA hagas commits directos a `main`.
- Cada cambio vive en su propia rama corta, con nombre descriptivo:
  `feat/<nombre>`, `fix/<nombre>`, `docs/<nombre>`, `chore/<nombre>`, `refactor/<nombre>`,
  `test/<nombre>`. Ejemplo: `feat/weather-data-layer`, `feat/turner-school`.
- Una rama = una unidad de trabajo coherente (no mezcles shaders, CI y docs en la misma rama).

Issues y milestones

- Antes de cada fase, crea un milestone (Phase 1, Phase 2…) y un issue por cada tarea
  relevante, con criterios de aceptación. Cada PR referencia su issue (`Closes #N`).

Commits

- Pequeños, atómicos y con Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`,
  `refactor:`, `perf:`, `chore:`, `ci:`. Mensaje en inglés, en imperativo, con alcance
  opcional: `feat(gl): add ping-pong framebuffer helper`.

Pull requests

- Al terminar cada rama, súbela y abre un Pull Request hacia `main` con `gh pr create`
  (o, si no hay `gh`, genera el texto del PR en /docs/pr/<branch>.md).
- Cada PR usa la plantilla de /.github/PULL_REQUEST_TEMPLATE.md e incluye:
  qué cambia y por qué · issue relacionado · capturas o GIF si hay cambio visual
  (obligatorio en shaders/UI) · cómo probarlo · checklist (lint, tests, build, docs, a11y).
- Haz una auto-revisión del diff antes de fusionar: lee tu propio PR, comenta lo que sea
  discutible, corrige y solo entonces haz merge.
- Fusiona con "squash and merge" para mantener un historial limpio en `main`, con el título
  del PR en formato Conventional Commit. Borra la rama tras el merge.
- Después de cada merge, vuelve a `main`, haz pull y crea la siguiente rama desde ahí.

Calidad y CI

- Configura GitHub Actions desde la primera rama de infraestructura (`chore/ci`):
  lint + typecheck + test + build en cada PR. Un PR solo se fusiona con CI en verde.
- Si es posible, protege `main` (PR obligatorio, CI obligatorio). Si no puedes, documenta
  la regla en CONTRIBUTING.md y respétala igualmente.
- Linting con ESLint + Prettier; hooks con husky + lint-staged + commitlint
  (para forzar Conventional Commits).

Versionado y releases

- Versionado semántico. Al cerrar cada fase: actualiza CHANGELOG.md (formato Keep a
  Changelog), crea un tag (`v0.1.0` tras la Fase 1, `v0.2.0` tras la Fase 2, etc.) y una
  release de GitHub con notas y capturas.

Definition of Done (para cada PR)

- Compila sin errores ni warnings · tests pasan · sin errores en consola · capturas
  verificadas visualmente · docs actualizadas · fps estables · accesibilidad revisada.

Plan de ramas sugerido para la Fase 1 (ajústalo si lo ves necesario):
chore/project-setup → chore/ci-and-linting → feat/weather-data-layer →
feat/gl-core-and-fluid → feat/turner-school → feat/city-search-and-url-state →
test/e2e-and-screenshots → docs/readme-v0

## 2. CONCEPTO

Una visualización de datos que convierte el clima real en pintura abstracta en movimiento,
con la sensación de Turner o del color field painting. NADA de gráficos de barras, mapas
meteorológicos fríos ni escalas azul→rojo.

- "Escala íntima": el usuario elige UNA ciudad (buscador por geocoding) y ve un retrato
  pictórico de su clima ahora mismo.
- "Modo anillo": un año completo comprimido en una espiral/anillo radial, como el anillo de
  un árbol, donde cada día es una pincelada.
- "Modo marco": pantalla completa, sin UI, que se actualiza solo y cambia muy despacio
  (transiciones de minutos) pensado para dejarlo en una pantalla de casa 24/7.
- Cada visualización tiene URL compartible (?city=...&school=...&seed=...&mode=...).

## 3. MAPEO POÉTICO DATO → GESTO

- Temperatura → tono dominante y calidez de la paleta (relativa al clima típico del lugar
  y la época, no absoluta).
- Viento (velocidad y dirección) → trazos largos y ondulantes: campo vectorial con partículas
  y curl noise; la velocidad controla longitud y tensión del trazo.
- Humedad → veladuras y transparencia de capas.
- Nubosidad → densidad y masa de los campos de color superiores.
- Presión → "peso" visual: composición más baja/densa vs. más alta/ligera.
- Lluvia → grano, goteo, pigmento que se corre.
  Cada mapeo es una función pura y documentada, con su justificación poética en comentario.

## 4. STACK

- TypeScript + Vite, sin framework de UI pesado (vanilla o Preact; la UI es mínima).
- WebGL2 + GLSL propios (sin Three.js salvo que lo justifiques en decisions.md).
  Simulación de fluido tipo Navier-Stokes simplificado en framebuffers ping-pong,
  curl noise para pinceladas, grano de película y papel como post-proceso.
- Datos: Open-Meteo (sin API key):
  · forecast/current: https://api.open-meteo.com/v1/forecast
  · geocoding: https://geocoding-api.open-meteo.com/v1/search
  · históricos: https://archive-api.open-meteo.com/v1/archive
  Cachea en memoria + localStorage con TTL, maneja errores y modo offline con datos de ejemplo.
- Tweakpane solo para un panel de debug/parámetros (oculto por defecto).
- Vitest para lógica pura (mapeos, paletas, serialización de URL). Playwright para e2e.

## 5. ARQUITECTURA DE PLUGINS (lo más importante para la comunidad)

Cada "escuela pictórica" es una carpeta autocontenida en /schools/<name>/ con:

- school.json (nombre, autor, licencia, descripción, referencias artísticas)
- palette.ts (paletas por condición: despejado, nublado, lluvia, tormenta, nieve, niebla)
- mapping.ts (opcional: sobrescribe mapeos dato→gesto)
- brush.frag / flow.frag / post.frag (shaders opcionales que sobrescriben los del núcleo)
  Define y documenta una interfaz clara:

interface School {
meta: SchoolMeta;
palette(w: WeatherSnapshot, ctx: PaletteContext): Palette;
mapping?: Partial<DataToGesture>;
shaders?: Partial<ShaderSet>;
}

El núcleo descubre las escuelas automáticamente (import.meta.glob). Añadir una escuela NO
debe requerir tocar el núcleo. Valida cada school.json con un schema y un test.
Incluye 3 escuelas desde el inicio, claramente distintas entre sí:

1. "turner" – atmósfera, bruma luminosa, ocres y dorados
2. "rothko" – campos de color rectangulares con bordes difusos, muy lento y meditativo
3. "hokusai" – tintas planas, olas/ondas de viento en líneas, paleta limitada
   (Las paletas deben estar inspiradas en los pintores sin copiar obras concretas.)

## 6. FASES (cada una = milestone + varias ramas/PRs, funcionando antes de pasar a la siguiente)

Fase 1 – MVP: una ciudad, datos reales de Open-Meteo, escuela "turner", render WebGL2 fluido
a 60 fps, buscador de ciudad minimalista, URL compartible. Debe verse hermoso ya aquí. → v0.1.0
Fase 2 – Sistema de escuelas: interfaz School, auto-descubrimiento, rothko + hokusai,
selector de escuela, transiciones lentas entre estados de datos (mezcla de minutos). → v0.2.0
Fase 3 – Modo marco (fullscreen, sin UI, wake lock, refresco automático) y modo anillo anual
con datos históricos. → v0.3.0
Fase 4 – Exportación: PNG de alta resolución por renderizado en mosaicos (hasta 8K) y
poster con tipografía sobria (ciudad, fecha, coordenadas) usando @canvas-design. → v0.4.0
Fase 5 – Comunidad: README espectacular, CONTRIBUTING.md, guía "Create your first school
in 15 minutes", plantillas de issues/PR, issues "good first issue" listados en
/docs/good-first-issues.md (y creados de verdad en GitHub con la etiqueta), galería
comunitaria en /gallery (cada entrada: seed + escuela + ciudad + render). → v1.0.0

## 7. CALIDAD VISUAL Y DE MOVIMIENTO

- Movimiento con tempo de "respiración": nunca bruscos, sin saltos; easing definido en un
  único archivo de tokens de movimiento.
- Respeta prefers-reduced-motion (reduce la velocidad de la simulación, no la apaga).
- Fallback elegante si no hay WebGL2 (mensaje poético + imagen estática).
- Degradación de calidad adaptativa si los fps bajan (resolución interna, número de partículas).
- UI mínima y contemplativa: tipografía con carácter (no Inter/Roboto por defecto), mucho
  espacio, controles que aparecen al mover el ratón y se desvanecen.
- Accesibilidad: contraste de la UI, navegación por teclado, aria-labels, descripción textual
  del clima actual para lectores de pantalla.

## 8. VERIFICACIÓN (obligatoria, antes de abrir cada PR visual)

Con @webapp-testing/Playwright: arranca el dev server, comprueba que el canvas renderiza
(captura de pantalla de cada escuela), que no hay errores en consola y que la URL
compartible restaura exactamente el estado. Mira las capturas, juzga si son bellas de verdad
y itera sobre los shaders hasta que lo sean. Guarda las capturas finales en /docs/screenshots
y adjúntalas al PR correspondiente.

## 9. ESTRUCTURA DE REPO ESPERADA

/src (core, gl, data, ui) · /schools · /docs · /gallery · /tests · /.github (workflows CI,
plantillas de issues y PR) · README.md · CONTRIBUTING.md · CODE_OF_CONDUCT.md ·
CHANGELOG.md · LICENSE (MIT)

## 10. REGLAS

- Cero clichés: nada de portfolio, galería estática, dashboards genéricos ni paletas de
  "arcoíris de datos".
- Nunca commits directos a `main` tras el inicial; todo entra por PR con CI en verde.
- Si una decisión es ambigua, elige, documenta en /docs/decisions.md y continúa.
- Al terminar cada fase: resume qué hiciste, qué se ve, qué PRs se fusionaron y qué viene después.

Empieza leyendo las skills y escribiendo /docs/art-direction.md (rama `docs/art-direction`,
con su PR); luego configura el repo, el milestone y los issues de la Fase 1, y ejecuta la
Fase 1 completa siguiendo el flujo de ramas y PRs.
