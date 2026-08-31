# Subasta de frases · Subhasta de frases

Aplicación web para realizar dinámicas participativas en tiempo real. Puede utilizarse en el aula, en formación de profesorado o con grupos de personas adultas.

## Modalidades

- **Conocimiento:** los participantes pujan por las frases que consideran correctas. La frase se adjudica al mejor postor, se revela la solución y se asigna `+1` o `-1` punto.
- **Valores y prioridades:** cada participante distribuye su presupuesto entre todas las frases. Las aportaciones permanecen ocultas hasta que la persona facilitadora cierra la actividad.

No hay un número máximo de frases impuesto por la aplicación.

## Funciones principales

- Editor completo desde la propia página.
- Número de frases sin límite artificial, reordenación, duplicado y pegado de listas.
- Nombre personalizable para la moneda de la actividad.
- Preparación anticipada mediante una URL comprimida que contiene la configuración.
- Conexión directa entre dispositivos con PeerJS/WebRTC, código de seis caracteres, enlace y QR.
- Identificación mediante nombre, alias o participación anónima.
- Reconexión con identidad persistente en el mismo dispositivo.
- Resultados colectivos y desglose individual opcional en las actividades de valores.
- Exportación de resultados en CSV.
- Interfaz en español y catalán, con detección automática y selector manual.

## Desarrollo local

Requiere Node.js 22 o posterior.

```bash
npm install
npm run dev
```

La aplicación queda disponible normalmente en `http://localhost:3000`.

Para validar una versión:

```bash
npm run lint
npm run build
```

## Añadir idiomas

1. Copiar uno de los archivos de `locales/` y traducir todos sus valores.
2. Añadir el idioma a `locales/index.json`.
3. Incorporar su código al tipo `Lang` y al registro de `lib/i18n.ts`.
4. Añadirlo al selector de idioma de `app/page.tsx`.

La selección manual se guarda en el navegador. También puede indicarse mediante `?lang=es` o `?lang=ca`.

## Privacidad y funcionamiento

El dispositivo de la persona facilitadora mantiene el estado oficial de la sesión. Los participantes se conectan directamente a él mediante WebRTC. No se requieren cuentas ni se guarda la actividad en una base de datos. PeerJS se utiliza para señalización y se configuran servidores STUN/TURN para facilitar la conexión entre redes distintas.

Los enlaces de preparación contienen los datos de la actividad, incluidas las soluciones en la modalidad de conocimiento. Deben conservarse como material del profesorado y no confundirse con el enlace de participación que se genera al iniciar la sesión.
