# VORTEX — Scorecard inicial

**Notas editoriales provisionales de 0–100; no son métricas de satisfacción ni certificación.** Corresponden al commit base, antes de los dos fixes. No se suben notas por tests aislados. Los cinco problemas de cada categoría remiten a VORTEX_AUDIT, que contiene evidencia, causa, solución, esfuerzo y criterio de cierre. Las limitaciones no se convierten artificialmente en cero ni en aprobados.

| Área | Peso | Nota | Cinco problemas/riesgos prioritarios | Justificación / confianza |
|---|---:|---:|---|---|
|Diversión inmediata y jugabilidad|20%|55|V11,V12,A21,A22,V18|Baja: revisión de ritmo, sin sensación de combate observada|
|Combate, armas y movimiento|15%|65|V09,V10,A22,A28,A30|Media-baja: lógica parcial; tacto, cámara y feedback sin playtest|
|Objetivos y claridad de misión|15%|68|V12,V14,V17,A21,A23|Media: HUD y planes existen; navegación y adaptación deficientes|
|Controles y experiencia móvil|10%|60|V04,V12,V15,V16,A30|Baja: código multitáctil, sin Safari/iPhone real|
|Diseño de niveles y exploración|10%|65|V14,V17,V11,A23,V20|Baja: seis arenas en código; recorrido visual actual pendiente|
|Identidad artística y audiovisual|10%|62|V20,A30,V04,V16,V18|Baja: identidad concreta; revisión actual/audio incompletos|
|Progresión y rejugabilidad|10%|58|V01,V07,V08,V13,V18|Media-baja: sistemas existentes y fallos reproducidos|
|Rendimiento y estabilidad|5%|50|V01,V04,V05,V06,A25|Media-baja: no hay FPS físico, publicación y guardado deficientes|
|Multijugador|5%|60|V02,V03,V19,A24,A28|Media: transporte y servidor existen; sesión humana remota pendiente|

**Global ponderada provisional: 60.95/100** (redondeada: 61). Fórmula: Σ(peso × nota)/100. No representa la diversión observada de una partida real.

## Junta por cargo
| Cargo | Nota de preparación del área | Dictamen |
|---|---:|---|
|CEO / Product|58|Demo acotada antes de lanzamiento|
|Game Director|55|Primer minuto y ciclo de recompensa|
|Creative Director|76|Limbo orgánico/folclórico distintivo, proteger coherencia|
|Technical Director|60|Buena separación sim/red; persistencia y gates débiles|
|Lead Gameplay|65|Arsenal/IA reales, validar tacto y corregir recompensas|
|Level Design|65|Seis arenas; orientar rutas y decidir campaña|
|Art Director|62|Gate visual actual pendiente; audio sin evaluar|
|UX/UI|60|Jerarquía de menú y opciones existen; onboarding denso|
|QA|45|No certificar suite verde sin navegador ni balance resuelto|
|Economy & Progression|58|Proteger ahorro antes de expandir economía|
|Player Psychology|55|Experimentación y comprensión primero|
|Críticos independientes|57.8|Promedio de cinco hipótesis, no usuarios reales|

## Críticos simulados — hipótesis, no opiniones reales
| Perfil | Nota hipotética | Reseña | Tres posibles motivos de abandono |
|---|---:|---|---|
|Shooter|60|Variedad suficiente; falta verificar precisión/lectura. DOOM y Warframe sirven como referencias de respuesta y movilidad, no equivalencia técnica comprobada.|Feedback confuso; exceso visual; latencia|
|Indie|74|El limbo orgánico y folclórico tiene personalidad.|Dilución temática; sistemas superpuestos; escenarios sin propósito|
|Casual|55|CTA ayuda, vocabulario y decisiones pueden superar el aprendizaje.|Vocabulario excesivo; mejora siguiente confusa; elección irreversible|
|Competitivo|50|Consistencia y autoridad de progresión aún sin certificar.|Poder declarado por cliente; builds no comparables; latencia sin validar|
|Móvil|50|La infraestructura táctil no sustituye prueba física.|Saturación visual; texto pequeño; progreso no guardado|

## Objetivos de salida
Jugabilidad 90; objetivos 95; controles 90; combate 90; niveles 85; arte 90; estabilidad 95; global 90. Requieren observación humana, hardware real y QA reproducible. Una nota de código no satisface estos objetivos.
