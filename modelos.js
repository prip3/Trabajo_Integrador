/* ==========================================================
   modelos.js  ·  Clases de la aplicación (POO)
   - Espacio, Usuario, Reserva: representan "cosas" del sistema.
   - SistemaReservas: coordina a las otras tres y usa localStorage.
   Encapsulamiento: las propiedades son privadas (#) y solo se
   accede a ellas con getters y setters que validan los datos.
   ========================================================== */

// ---------- Constantes y funciones auxiliares ----------
const FRANJAS = ["07:30 - 08:50", "09:00 - 10:20", "10:30 - 11:50",
                 "12:00 - 13:20", "14:00 - 15:20", "15:30 - 16:50"];
const TIPOS_ESPACIO = ["Aula", "Laboratorio", "Sala de computación", "SUM", "Biblioteca"];
const ROLES = ["Alumno", "Docente", "Preceptor"];

// Genera un identificador único para cada objeto
function crearId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Fecha de hoy en formato AAAA-MM-DD (hora local, no UTC)
function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Valida un texto: lo limpia y exige un largo mínimo
function textoValido(valor, campo, min = 2) {
    const t = String(valor ?? "").trim();
    if (t.length < min) throw new Error(`${campo} debe tener al menos ${min} caracteres.`);
    return t;
}

// ---------- Clase Espacio ----------
class Espacio {
    #id; #nombre; #tipo; #capacidad;

    constructor(nombre, tipo, capacidad, id = crearId()) {
        this.#id = id;
        this.nombre = nombre;       // usa el setter (valida)
        this.tipo = tipo;
        this.capacidad = capacidad;
    }

    get id() { return this.#id; }                 // el id no tiene setter: no se puede cambiar
    get nombre() { return this.#nombre; }
    set nombre(v) { this.#nombre = textoValido(v, "El nombre del espacio"); }
    get tipo() { return this.#tipo; }
    set tipo(v) {
        if (!TIPOS_ESPACIO.includes(v)) throw new Error("Tipo de espacio inválido.");
        this.#tipo = v;
    }
    get capacidad() { return this.#capacidad; }
    set capacidad(v) {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 500) throw new Error("La capacidad debe ser un número entero entre 1 y 500.");
        this.#capacidad = n;
    }

    // JSON.stringify no ve los campos privados, por eso definimos toJSON
    toJSON() { return { id: this.#id, nombre: this.#nombre, tipo: this.#tipo, capacidad: this.#capacidad }; }
    static desdeJSON(o) { return new Espacio(o.nombre, o.tipo, o.capacidad, o.id); }
}

// ---------- Clase Usuario ----------
class Usuario {
    #id; #nombre; #rol; #detalle;

    constructor(nombre, rol, detalle = "", id = crearId()) {
        this.#id = id;
        this.nombre = nombre;
        this.rol = rol;
        this.detalle = detalle;
    }

    get id() { return this.#id; }
    get nombre() { return this.#nombre; }
    set nombre(v) { this.#nombre = textoValido(v, "El nombre"); }
    get rol() { return this.#rol; }
    set rol(v) {
        if (!ROLES.includes(v)) throw new Error("Rol inválido.");
        this.#rol = v;
    }
    get detalle() { return this.#detalle; }
    set detalle(v) { this.#detalle = String(v ?? "").trim(); }   // opcional

    toJSON() { return { id: this.#id, nombre: this.#nombre, rol: this.#rol, detalle: this.#detalle }; }
    static desdeJSON(o) { return new Usuario(o.nombre, o.rol, o.detalle, o.id); }
}

// ---------- Clase Reserva ----------
// Une a un Usuario con un Espacio en una fecha y un horario.
// Guarda solo los ids; el sistema se encarga de buscar los objetos.
class Reserva {
    #id; #usuarioId; #espacioId; #fecha; #franja; #motivo;

    constructor(usuarioId, espacioId, fecha, franja, motivo, id = crearId()) {
        this.#id = id;
        this.#usuarioId = usuarioId;
        this.#espacioId = espacioId;
        this.fecha = fecha;
        this.franja = franja;
        this.motivo = motivo;
    }

    get id() { return this.#id; }
    get usuarioId() { return this.#usuarioId; }
    get espacioId() { return this.#espacioId; }
    get fecha() { return this.#fecha; }
    set fecha(v) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("Elegí una fecha válida.");
        this.#fecha = v;
    }
    get franja() { return this.#franja; }
    set franja(v) {
        if (!FRANJAS.includes(v)) throw new Error("Horario inválido.");
        this.#franja = v;
    }
    get motivo() { return this.#motivo; }
    set motivo(v) { this.#motivo = textoValido(v, "El motivo", 3); }

    toJSON() {
        return { id: this.#id, usuarioId: this.#usuarioId, espacioId: this.#espacioId,
                 fecha: this.#fecha, franja: this.#franja, motivo: this.#motivo };
    }
    static desdeJSON(o) { return new Reserva(o.usuarioId, o.espacioId, o.fecha, o.franja, o.motivo, o.id); }
}

// ---------- Clase SistemaReservas ----------
// Es el "cerebro": guarda las listas de objetos, aplica las reglas
// (no reservar dos veces el mismo horario, no reservar en el pasado)
// y se encarga de la persistencia en localStorage.
class SistemaReservas {
    static CLAVE = "reservas_escuela_v1";
    #espacios = []; #usuarios = []; #reservas = [];

    constructor() { this.cargar(); }

    // Getters que devuelven copias: nadie puede modificar las listas desde afuera
    get espacios() { return [...this.#espacios]; }
    get usuarios() { return [...this.#usuarios]; }
    get reservas() { return [...this.#reservas]; }

    // ----- Persistencia -----
    guardar() {
        localStorage.setItem(SistemaReservas.CLAVE, JSON.stringify({
            espacios: this.#espacios, usuarios: this.#usuarios, reservas: this.#reservas
        }));
    }
    cargar() {
        try {
            const datos = JSON.parse(localStorage.getItem(SistemaReservas.CLAVE));
            if (!datos) return;
            this.#espacios = (datos.espacios || []).map(Espacio.desdeJSON);
            this.#usuarios = (datos.usuarios || []).map(Usuario.desdeJSON);
            this.#reservas = (datos.reservas || []).map(Reserva.desdeJSON);
        } catch (e) {          // datos corruptos: empezamos de cero
            this.#espacios = []; this.#usuarios = []; this.#reservas = [];
        }
    }
    borrarTodo() {
        this.#espacios = []; this.#usuarios = []; this.#reservas = [];
        this.guardar();
    }

    // ----- Búsquedas -----
    buscarEspacio(id) { return this.#espacios.find(e => e.id === id); }
    buscarUsuario(id) { return this.#usuarios.find(u => u.id === id); }

    // ----- Espacios -----
    agregarEspacio(nombre, tipo, capacidad) {
        const nuevo = new Espacio(nombre, tipo, capacidad);   // valida con los setters
        if (this.#espacios.some(e => e.nombre.toLowerCase() === nuevo.nombre.toLowerCase()))
            throw new Error("Ya existe un espacio con ese nombre.");
        this.#espacios.push(nuevo);
        this.guardar();
        return nuevo;
    }
    eliminarEspacio(id) {
        if (this.#reservas.some(r => r.espacioId === id))
            throw new Error("No se puede eliminar: el espacio tiene reservas. Cancelalas primero.");
        this.#espacios = this.#espacios.filter(e => e.id !== id);
        this.guardar();
    }

    // ----- Usuarios -----
    agregarUsuario(nombre, rol, detalle) {
        const nuevo = new Usuario(nombre, rol, detalle);
        this.#usuarios.push(nuevo);
        this.guardar();
        return nuevo;
    }
    eliminarUsuario(id) {
        if (this.#reservas.some(r => r.usuarioId === id))
            throw new Error("No se puede eliminar: el usuario tiene reservas. Cancelalas primero.");
        this.#usuarios = this.#usuarios.filter(u => u.id !== id);
        this.guardar();
    }
    reservasDe(usuarioId) { return this.#reservas.filter(r => r.usuarioId === usuarioId); }

    // ----- Reservas (aquí trabajan juntas las 4 clases) -----
    reservar(usuarioId, espacioId, fecha, franja, motivo) {
        const usuario = this.buscarUsuario(usuarioId);
        const espacio = this.buscarEspacio(espacioId);
        if (!usuario || !espacio) throw new Error("Elegí un usuario y un espacio.");

        const nueva = new Reserva(usuarioId, espacioId, fecha, franja, motivo);   // valida
        if (nueva.fecha < hoyISO()) throw new Error("No se puede reservar en una fecha pasada.");

        const choque = this.#reservas.find(r =>
            r.espacioId === espacioId && r.fecha === fecha && r.franja === franja);
        if (choque) {
            const quien = this.buscarUsuario(choque.usuarioId);
            throw new Error(`${espacio.nombre} ya está reservado ese día y horario por ${quien ? quien.nombre : "otro usuario"}.`);
        }
        this.#reservas.push(nueva);
        this.guardar();
        return nueva;
    }
    cancelar(id) {
        this.#reservas = this.#reservas.filter(r => r.id !== id);
        this.guardar();
    }
    // Devuelve las reservas filtradas y ordenadas por fecha y horario
    reservasFiltradas(espacioId = "", fecha = "") {
        return this.#reservas
            .filter(r => (!espacioId || r.espacioId === espacioId) && (!fecha || r.fecha === fecha))
            .sort((a, b) => a.fecha.localeCompare(b.fecha) || FRANJAS.indexOf(a.franja) - FRANJAS.indexOf(b.franja));
    }

    // ----- Estadísticas para la vista Resumen -----
    estadisticas() {
        const hoy = hoyISO();
        const porEspacio = this.#espacios.map(e => ({
            nombre: e.nombre,
            cantidad: this.#reservas.filter(r => r.espacioId === e.id).length
        })).sort((a, b) => b.cantidad - a.cantidad);
        const porUsuario = this.#usuarios.map(u => ({ nombre: u.nombre, cantidad: this.reservasDe(u.id).length }))
            .sort((a, b) => b.cantidad - a.cantidad);
        return {
            total: this.#reservas.length,
            proximas: this.#reservas.filter(r => r.fecha >= hoy).length,
            espacioTop: porEspacio.length && porEspacio[0].cantidad ? porEspacio[0].nombre : "—",
            usuarioTop: porUsuario.length && porUsuario[0].cantidad ? porUsuario[0].nombre : "—",
            porEspacio
        };
    }

    // ----- Datos de ejemplo (útiles para probar y para las capturas) -----
    cargarEjemplo() {
        const lab = this.agregarEspacio("Laboratorio 1", "Laboratorio", 24);
        const sum = this.agregarEspacio("SUM", "SUM", 120);
        const aula = this.agregarEspacio("Aula 3", "Aula", 30);
        const ana = this.agregarUsuario("Ana Pérez", "Docente", "Programación IV");
        const leo = this.agregarUsuario("Leo Gómez", "Alumno", "4° año");
        const hoy = hoyISO();
        this.reservar(ana.id, lab.id, hoy, FRANJAS[1], "Clase de Programación IV");
        this.reservar(leo.id, sum.id, hoy, FRANJAS[3], "Ensayo del acto");
        this.reservar(ana.id, aula.id, hoy, FRANJAS[4], "Tutoría");
    }
}
