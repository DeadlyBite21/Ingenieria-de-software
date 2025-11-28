// src/pages/UserManagementPage.jsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';

// Agregamos el icono de descarga (FileEarmarkArrowDown)
import { Trash, PersonPlusFill, FileEarmarkArrowDown } from 'react-bootstrap-icons';

export default function UserManagementPage() {
    const { user } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [cursos, setCursos] = useState([]);
    const [courseUsers, setCourseUsers] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Estados para crear usuario
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [newUser, setNewUser] = useState({
        rol: '',
        rut: '',
        nombre: '',
        correo: '',
        contrasena: ''
    });

    // Filtros
    const [filtroRol, setFiltroRol] = useState('todos');
    const [filtroCurso, setFiltroCurso] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usuariosData, cursosData] = await Promise.all([
                apiFetch('/api/usuarios'),
                apiFetch('/api/cursos')
            ]);
            setUsuarios(usuariosData);
            setCursos(cursosData);

            // Cargar usuarios de cada curso para el filtro
            const courseUsersData = {};
            for (const curso of cursosData) {
                try {
                    const users = await apiFetch(`/api/cursos/${curso.id}/usuarios`);
                    courseUsersData[curso.id] = users;
                } catch (err) {
                    courseUsersData[curso.id] = [];
                }
            }
            setCourseUsers(courseUsersData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await apiFetch('/api/usuarios/crear', {
                method: 'POST',
                body: JSON.stringify(newUser)
            });
            setNewUser({ rol: '', rut: '', nombre: '', correo: '', contrasena: '' });
            setShowCreateUser(false);
            loadData();
            alert('Usuario creado exitosamente');
        } catch (err) {
            alert('Error al crear usuario: ' + err.message);
        }
    };

    const handleDeleteUser = async (userId, userName) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar al usuario "${userName}"?`)) {
            try {
                await apiFetch(`/api/usuarios/${userId}`, { method: 'DELETE' });
                loadData();
                alert('Usuario eliminado exitosamente');
            } catch (err) {
                alert('Error al eliminar usuario: ' + err.message);
            }
        }
    };

    // --- Lógica de Filtrado ---
    const usuariosFiltrados = usuarios.filter(u => {
        let pasaFiltroRol = false;
        if (filtroRol === 'todos') pasaFiltroRol = true;
        else if (filtroRol === 'alumnos' && u.rol === 2) pasaFiltroRol = true;
        else if (filtroRol === 'profesores' && u.rol === 1) pasaFiltroRol = true;
        else if (filtroRol === 'admins' && u.rol === 0) pasaFiltroRol = true;

        if (!pasaFiltroRol) return false;

        if (filtroRol === 'alumnos' && filtroCurso) {
            const usuariosDelCurso = courseUsers[filtroCurso] || [];
            return usuariosDelCurso.some(userInCourse => userInCourse.id === u.id);
        }
        return true;
    });

    // --- NUEVA FUNCIÓN: Descargar CSV ---
    const handleDownloadCSV = () => {
        if (usuariosFiltrados.length === 0) {
            alert("No hay usuarios en la lista para descargar.");
            return;
        }

        // 1. Definir cabecera
        const headers = ["rut", "nombre", "email", "rol"];

        // 2. Convertir datos a formato CSV
        const rows = usuariosFiltrados.map(u => {
            // Traducir el número de rol a texto
            let rolTexto = 'Desconocido';
            if (u.rol === 0) rolTexto = 'Administrador';
            else if (u.rol === 1) rolTexto = 'Profesor';
            else if (u.rol === 2) rolTexto = 'Alumno';

            // Importante: Envolver nombre en comillas por si tiene comas
            return [
                u.rut,
                `"${u.nombre}"`,
                u.correo, // En la BD se llama 'correo', en el CSV saldrá como 'email' por el header
                rolTexto
            ].join(",");
        });

        // 3. Unir cabecera y filas con saltos de línea
        const csvContent = [headers.join(","), ...rows].join("\n");

        // 4. Crear un Blob y un enlace temporal para descargar
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);

        // Nombre del archivo dinámico
        const nombreArchivo = filtroCurso
            ? `lista_curso_${filtroCurso}.csv`
            : 'lista_usuarios.csv';

        link.setAttribute("download", nombreArchivo);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getFiltroBtnStyle = (tipo) => ({
        padding: '8px 12px',
        backgroundColor: filtroRol === tipo ? '#007bff' : '#f8f9fa',
        color: filtroRol === tipo ? 'white' : '#333',
        border: '1px solid #ddd',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: filtroRol === tipo ? 'bold' : 'normal',
        marginRight: '8px'
    });

    const cambiarFiltroRol = (nuevoRol) => {
        setFiltroRol(nuevoRol);
        if (nuevoRol !== 'alumnos') setFiltroCurso('');
    };

    if (loading) return <div className="p-4">Cargando usuarios...</div>;
    if (error) return <div className="p-4 text-danger">Error: {error}</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Gestión de Usuarios</h1>
                <button
                    onClick={() => setShowCreateUser(!showCreateUser)}
                    className="btn btn-success"
                >
                    {showCreateUser ? 'Cancelar' : <><PersonPlusFill className="me-2" />Crear Usuario</>}
                </button>
            </div>

            {showCreateUser && (
                <div className="card p-3 mb-4 bg-light">
                    {/* ... (Formulario de creación igual que antes) ... */}
                    <form onSubmit={handleCreateUser} className="row g-2">
                        <div className="col-md-2">
                            <select className="form-select" value={newUser.rol} onChange={(e) => setNewUser({ ...newUser, rol: parseInt(e.target.value) })} required>
                                <option value="">Rol</option>
                                <option value={0}>Admin</option>
                                <option value={1}>Profesor</option>
                                <option value={2}>Alumno</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <input type="text" className="form-control" placeholder="RUT" value={newUser.rut} onChange={(e) => setNewUser({ ...newUser, rut: e.target.value })} required />
                        </div>
                        <div className="col-md-3">
                            <input type="text" className="form-control" placeholder="Nombre" value={newUser.nombre} onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })} required />
                        </div>
                        <div className="col-md-3">
                            <input type="email" className="form-control" placeholder="Correo" value={newUser.correo} onChange={(e) => setNewUser({ ...newUser, correo: e.target.value })} required />
                        </div>
                        <div className="col-md-2">
                            <input type="password" className="form-control" placeholder="Contraseña" value={newUser.contrasena} onChange={(e) => setNewUser({ ...newUser, contrasena: e.target.value })} required />
                        </div>
                        <div className="col-12 text-end">
                            <button type="submit" className="btn btn-primary mt-2">Guardar</button>
                        </div>
                    </form>
                </div>
            )}

            {/* --- Filtros y Botón CSV --- */}
            <div className="mb-3 p-3 bg-white border rounded d-flex flex-wrap align-items-center gap-3">
                <div>
                    <span className="me-2 fw-bold">Filtrar por Rol:</span>
                    <button style={getFiltroBtnStyle('todos')} onClick={() => cambiarFiltroRol('todos')}>Todos ({usuarios.length})</button>
                    <button style={getFiltroBtnStyle('alumnos')} onClick={() => cambiarFiltroRol('alumnos')}>Alumnos ({usuarios.filter(u => u.rol === 2).length})</button>
                    <button style={getFiltroBtnStyle('profesores')} onClick={() => cambiarFiltroRol('profesores')}>Profesores ({usuarios.filter(u => u.rol === 1).length})</button>
                    <button style={getFiltroBtnStyle('admins')} onClick={() => cambiarFiltroRol('admins')}>Admins ({usuarios.filter(u => u.rol === 0).length})</button>
                </div>

                {filtroRol === 'alumnos' && (
                    <div>
                        <span className="me-2 fw-bold">Filtrar por Curso:</span>
                        <select className="form-select d-inline-block w-auto" value={filtroCurso} onChange={(e) => setFiltroCurso(e.target.value)}>
                            <option value="">Todos los Cursos</option>
                            {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>
                )}

                {/* --- BOTÓN DESCARGAR CSV --- */}
                <div className="ms-auto">
                    <button
                        className="btn btn-outline-success d-flex align-items-center"
                        onClick={handleDownloadCSV}
                        title="Descargar lista actual en CSV"
                        disabled={usuariosFiltrados.length === 0}
                    >
                        <FileEarmarkArrowDown className="me-2" />
                        Descargar CSV
                    </button>
                </div>
            </div>

            {/* --- Tabla --- */}
            <div className="table-responsive bg-white border rounded">
                <table className="table table-hover mb-0">
                    <thead className="table-light">
                        <tr>
                            <th>RUT</th>
                            <th>Nombre</th>
                            <th>Correo</th>
                            <th>Rol</th>
                            <th className="text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usuariosFiltrados.map((u) => (
                            <tr key={u.id}>
                                <td>{u.rut}</td>
                                <td>{u.nombre}</td>
                                <td>{u.correo}</td>
                                <td>
                                    <span className={`badge ${u.rol === 0 ? 'bg-danger' : u.rol === 1 ? 'bg-warning text-dark' : 'bg-primary'}`}>
                                        {u.rol === 0 ? 'Admin' : u.rol === 1 ? 'Profesor' : 'Alumno'}
                                    </span>
                                </td>
                                <td className="text-center">
                                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteUser(u.id, u.nombre)}>
                                        <Trash /> Eliminar
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {usuariosFiltrados.length === 0 && (
                            <tr><td colSpan="5" className="text-center p-3">No hay resultados.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}