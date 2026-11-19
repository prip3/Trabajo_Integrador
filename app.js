/* ==========================================================
   app.js  ·  Interfaz: conecta el HTML con las clases
   Es compartido por todas las páginas: cada función revisa si los
   elementos que necesita existen en la página actual.
   Cada acción del usuario llama a un método de SistemaReservas
   y después se vuelve a dibujar la pantalla (renderTodo).
   ========================================================== */

const sistema = new SistemaReservas();      // al crearse, carga lo guardado en localStorage
const $ = id => document.getElementById(id);

// ---------- Utilidades de interfaz ----------
// Muestra un mensaje de éxito o de error durante 4 segundos
function aviso(texto, tipo = "ok") {
    const m = $("mensaje");
    m.textContent = texto;
    m.className = "mensaje " + tipo;
    clearTimeout(aviso.timer);
    aviso.timer = setTimeout(() => { m.textContent = ""; m.className = "mensaje"; }, 4000);
}

// Ejecuta una acción y, si una clase lanza un error de validación, lo muestra
function intentar(accion, textoOk) {
    try { accion(); if (textoOk) aviso(textoOk); }
    catch (e) { aviso(e.message, "error"); return false; }
    renderTodo();
    return true;
}

// Crea una celda <td> usando textContent (evita inyectar HTML)
function celda(texto, etiqueta) {
    const td = document.createElement("td");
    td.textContent = texto;
    td.dataset.label = etiqueta;           // se usa en celulares (CSS)
    return td;
}
// Crea una fila con celdas de texto y un botón de acción al final
function fila(datos, textoBoton, alHacerClick) {
    const tr = document.createElement("tr");
    datos.forEach(([etiqueta, texto]) => tr.appendChild(celda(texto, etiqueta)));
    const td = document.createElement("td");
    td.dataset.label = "Acción";
    const b = document.createElement("button");
    b.type = "button"; b.className = "peligro chico"; b.textContent = textoBoton;
    b.addEventListener("click", alHacerClick);
    td.appendChild(b); tr.appendChild(td);
    return tr;
}
// Rellena un <select> con opciones [valor, texto] y conserva la selección
function llenarSelect(select, opciones, primera = null) {
    if (!select) return;      // la página actual no tiene este <select>
    const actual = select.value;
    select.innerHTML = "";
    if (primera) select.add(new Option(primera, ""));
    opciones.forEach(([v, t]) => select.add(new Option(t, v)));
    if ([...select.options].some(o => o.value === actual)) select.value = actual;
}
function formatearFecha(iso) { const [a, m, d] = iso.split("-"); return `${d}/${m}/${a}`; }

// ---------- Dibujar cada vista ----------
function renderSelects() {
    llenarSelect($("res-usuario"), sistema.usuarios.map(u => [u.id, `${u.nombre} (${u.rol})`]));
    llenarSelect($("res-espacio"), sistema.espacios.map(e => [e.id, e.nombre]));
    llenarSelect($("fil-espacio"), sistema.espacios.map(e => [e.id, e.nombre]), "Todos los espacios");
    llenarSelect($("res-franja"), FRANJAS.map(f => [f, f]));
    llenarSelect($("esp-tipo"), TIPOS_ESPACIO.map(t => [t, t]));
    llenarSelect($("usu-rol"), ROLES.map(r => [r, r]));
    const faltan = !sistema.espacios.length || !sistema.usuarios.length;
    if ($("form-reserva")) {
        $("aviso-faltan-datos").hidden = !faltan;
        $("form-reserva").querySelector("button").disabled = faltan;
    }
}

function renderReservas() {
    if (!$("tabla-reservas")) return;
    const lista = sistema.reservasFiltradas($("fil-espacio").value, $("fil-fecha").value);
    const cuerpo = $("tabla-reservas");
    cuerpo.innerHTML = "";
    lista.forEach(r => {
        const esp = sistema.buscarEspacio(r.espacioId), usu = sistema.buscarUsuario(r.usuarioId);
        cuerpo.appendChild(fila([
            ["Fecha", formatearFecha(r.fecha)], ["Horario", r.franja],
            ["Espacio", esp ? esp.nombre : "(eliminado)"], ["Reservado por", usu ? usu.nombre : "(eliminado)"],
            ["Motivo", r.motivo]
        ], "Cancelar", () => {
            if (confirm("¿Cancelar esta reserva?")) intentar(() => sistema.cancelar(r.id), "Reserva cancelada.");
        }));
    });
    $("vacio-reservas").hidden = lista.length > 0;
}

function renderEspacios() {
    if (!$("tabla-espacios")) return;
    const cuerpo = $("tabla-espacios");
    cuerpo.innerHTML = "";
    sistema.espacios.forEach(e => cuerpo.appendChild(fila(
        [["Nombre", e.nombre], ["Tipo", e.tipo], ["Capacidad", e.capacidad]], "Eliminar",
        () => { if (confirm(`¿Eliminar ${e.nombre}?`)) intentar(() => sistema.eliminarEspacio(e.id), "Espacio eliminado."); })));
    $("vacio-espacios").hidden = sistema.espacios.length > 0;
}

function renderUsuarios() {
    if (!$("tabla-usuarios")) return;
    const cuerpo = $("tabla-usuarios");
    cuerpo.innerHTML = "";
    sistema.usuarios.forEach(u => cuerpo.appendChild(fila(
        [["Nombre", u.nombre], ["Rol", u.rol], ["Curso / Materia", u.detalle || "-"],
         ["Reservas", sistema.reservasDe(u.id).length]], "Eliminar",
        () => { if (confirm(`¿Eliminar a ${u.nombre}?`)) intentar(() => sistema.eliminarUsuario(u.id), "Usuario eliminado."); })));
    $("vacio-usuarios").hidden = sistema.usuarios.length > 0;
}

function renderResumen() {
    if (!$("tarjetas")) return;
    const s = sistema.estadisticas();
    const datos = [["Reservas totales", s.total], ["Próximas (desde hoy)", s.proximas],
                   ["Espacio más usado", s.espacioTop], ["Usuario más activo", s.usuarioTop]];
    $("tarjetas").innerHTML = "";
    datos.forEach(([titulo, valor]) => {
        const div = document.createElement("div"); div.className = "tarjeta";
        const n = document.createElement("strong"); n.textContent = valor;
        const t = document.createElement("span"); t.textContent = titulo;
        div.append(n, t); $("tarjetas").appendChild(div);
    });
    // Barras de ocupación (el ancho es proporcional a la cantidad de reservas)
    const max = Math.max(1, ...s.porEspacio.map(p => p.cantidad));
    $("barras").innerHTML = "";
    s.porEspacio.forEach(p => {
        const f = document.createElement("div"); f.className = "barra-fila";
        const nombre = document.createElement("span"); nombre.textContent = `${p.nombre} (${p.cantidad})`;
        const pista = document.createElement("div"); pista.className = "barra-pista";
        const barra = document.createElement("div"); barra.className = "barra";
        barra.style.width = (p.cantidad / max * 100) + "%";
        pista.appendChild(barra); f.append(nombre, pista); $("barras").appendChild(f);
    });
}

function renderTodo() {
    renderSelects(); renderReservas(); renderEspacios(); renderUsuarios(); renderResumen();
}

// ---------- Eventos ----------
$("form-reserva")?.addEventListener("submit", e => {
    e.preventDefault();
    const ok = intentar(() => sistema.reservar($("res-usuario").value, $("res-espacio").value,
        $("res-fecha").value, $("res-franja").value, $("res-motivo").value), "¡Reserva realizada!");
    if (ok) $("res-motivo").value = "";
});
$("form-espacio")?.addEventListener("submit", e => {
    e.preventDefault();
    const ok = intentar(() => sistema.agregarEspacio($("esp-nombre").value, $("esp-tipo").value,
        $("esp-capacidad").value), "Espacio agregado.");
    if (ok) e.target.reset();
});
$("form-usuario")?.addEventListener("submit", e => {
    e.preventDefault();
    const ok = intentar(() => sistema.agregarUsuario($("usu-nombre").value, $("usu-rol").value,
        $("usu-detalle").value), "Usuario agregado.");
    if (ok) e.target.reset();
});

// Filtros
$("fil-espacio")?.addEventListener("change", renderReservas);
$("fil-fecha")?.addEventListener("change", renderReservas);
$("btn-limpiar-filtros")?.addEventListener("click", () => {
    $("fil-espacio").value = ""; $("fil-fecha").value = ""; renderReservas();
});

// Resumen: datos de ejemplo y borrado general
$("btn-ejemplo")?.addEventListener("click", () => intentar(() => sistema.cargarEjemplo(), "Datos de ejemplo cargados."));
$("btn-borrar")?.addEventListener("click", () => {
    if (confirm("Se borrarán espacios, usuarios y reservas. ¿Continuar?")) intentar(() => sistema.borrarTodo(), "Datos borrados.");
});

// Inicio: la fecha mínima para reservar es hoy
if ($("res-fecha")) { $("res-fecha").min = hoyISO(); $("res-fecha").value = hoyISO(); }
renderTodo();
