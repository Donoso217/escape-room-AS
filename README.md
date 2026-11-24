# El baúl de la Puebla

Escape room web del taller «Detrás de la máscara» (Grupo 1, SE1100 Acción Social).

Cada equipo abre cuatro candados y junta los pedazos de una palabra secreta:

1. **El candado del tiempo**: ordenar seis hechos de la historia de la mascarada.
2. **¿Quién está detrás de la máscara?**: adivinar tres personajes destapando piezas.
3. **El taller del mascarero**: clasificar materiales de antes y de ahora.
4. **La combinación final**: el día y el mes del Día de la Mascarada.

Al final se arma la palabra **MANTUDO**. El puntaje es el tiempo más 30 s por pista y 15 s por error. Dura unos 15 a 25 minutos.

## 1. Supabase (para el ranking en vivo)

1. Crear un proyecto gratis en https://supabase.com.
2. Ir a **SQL Editor**, pegar el contenido de `supabase.sql` y darle **Run**.
3. Ir a **Project Settings → API** y copiar la **Project URL** y la clave **anon / publishable**.
4. Pegarlas en `config.js`:

```js
window.ESCAPE_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJ..."
};
```

Si `config.js` se deja vacío, el juego funciona en **modo local**: se puede jugar, pero no hay panel del anfitrión ni ranking compartido.

## 2. Publicar

**GitHub Pages**: crear un repositorio, subir todos los archivos de esta carpeta, ir a **Settings → Pages**, elegir la rama `main` y la carpeta `/ (root)`. La página queda en `https://usuario.github.io/repositorio/`.

**Vercel**: importar el repositorio, framework «Other», sin comando de build. Listo.

## 3. Cómo se usa en la clase

1. El anfitrión abre la página → **Abrir panel**, elige equipos de 3, 4 o 5, pega los nombres (o solo pone cuántas personas hay) y crea la partida.
2. El panel muestra un código de 4 letras y los equipos armados al azar. Se pasa cada equipo a su sala de grupo.
3. En cada equipo, una persona abre la página → **Entrar al juego**, escribe el código, elige su equipo y comparte pantalla.
4. El anfitrión comparte el panel con el ranking en vivo. Al terminar se muestra el podio.

Si alguien recarga la página, el juego ofrece continuar donde iba.

## Archivos

- `index.html`, `styles.css`: página y estilos.
- `app.js`: lógica del juego y del panel.
- `masks.js`: ilustraciones de las máscaras (SVG originales).
- `config.js`: datos de Supabase.
- `supabase.sql`: tablas y permisos.
