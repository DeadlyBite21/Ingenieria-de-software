// src/pages/UserManagementPage.jsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';

// --- Bootstrap Components ---
import {
    Modal,
    Button,
    Form,
    FloatingLabel,
    Toast,
    ToastContainer,
    Table
} from 'react-bootstrap';

// --- Iconos ---
import {
    Trash,
    PersonPlusFill,
    FileEarmarkArrowDown,
    ExclamationTriangleFill,
    CheckCircleFill,
    XCircleFill,
    FunnelFill, // Nuevo icono para filtrar
    Download    // Nuevo icono para descargar
} from 'react-bootstrap-icons';

export default function UserManagementPage() {
    const { user } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [cursos, setCursos] = useState([]);
    const [courseUsers, setCourseUsers] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // --- Estados de Modals ---
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false); // Nuevo estado para el modal de filtros

    // --- Estados de Datos ---
    const [newUser, setNewUser] = useState({
        rol: '',
        rut: '',
        nombre: '',
        correo: '',
        contrasena: ''
    });
    const [userToDelete, setUserToDelete] = useState(null);

    // --- Estado para Notificaciones (Toasts) ---
    const [toastConfig, setToastConfig] = useState({
        show: false,
        message: '',
        variant: 'success'
    });

    // Filtros
    const [filtroRol, setFiltroRol] = useState('todos');
    const [filtroCurso, setFiltroCurso] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const showToast = (message, variant = 'success') => {
        setToastConfig({ show: true, message, variant });
    };

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
            showToast('Error al cargar datos: ' + err.message, 'danger');
        } finally {
            setLoading(false);
        }
    };

    // --- Handlers ---

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            // Convertir rol a entero
            const payload = { ...newUser, rol: parseInt(newUser.rol) };

            await apiFetch('/api/usuarios/crear', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            setNewUser({ rol: '', rut: '', nombre: '', correo: '', contrasena: '' });
            setShowCreateUser(false);
            loadData();
            showToast('Usuario creado exitosamente', 'success');
        } catch (err) {
            showToast('Error al crear usuario: ' + err.message, 'danger');
        }
    };

    const requestDeleteUser = (user) => {
        setUserToDelete(user);
        setShowDeleteModal(true);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            await apiFetch(`/api/usuarios/${userToDelete.id}`, { method: 'DELETE' });
            loadData();
            showToast(`Se eliminó al usuario "${userToDelete.nombre}" exitosamente`, 'success');
        } catch (err) {
            showToast('Error al eliminar usuario: ' + err.message, 'danger');
        } finally {
            setShowDeleteModal(false);
            setUserToDelete(null);
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

    // --- Descargar CSV ---
    const handleDownloadCSV = () => {
        if (usuariosFiltrados.length === 0) {
            showToast("No hay usuarios en la lista para descargar.", 'warning');
            return;
        }

        const headers = ["rut", "nombre", "email", "rol"];
        const rows = usuariosFiltrados.map(u => {
            let rolTexto = 'Desconocido';
            if (u.rol === 0) rolTexto = 'Administrador';
            else if (u.rol === 1) rolTexto = 'Profesor';
            else if (u.rol === 2) rolTexto = 'Alumno';

            return [
                u.rut,
                `"${u.nombre}"`,
                u.correo,
                rolTexto
            ].join(",");
        });

        const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);

        const nombreArchivo = filtroCurso
            ? `lista_curso_${filtroCurso}.csv`
            : 'lista_usuarios.csv';

        link.setAttribute("download", nombreArchivo);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Función auxiliar para resetear filtros al cerrar o limpiar
    const handleResetFilters = () => {
        setFiltroRol('todos');
        setFiltroCurso('');
        setShowFilterModal(false);
    };

    if (loading) return <div className="p-4 text-center">Cargando usuarios...</div>;
    if (error) return <div className="p-4 text-danger">Error crítico: {error}</div>;

    return (
        <div>
            {/* --- Header Estilizado --- */}
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h1 className="fw-bold m-0" style={{ fontFamily: 'sans-serif', fontSize: '2.5rem', letterSpacing: '-1px' }}>
                    GESTIÓN DE USUARIOS
                </h1>

                {/* Grupo de Botones de Acción */}
                <div className="d-flex gap-2">
                    {/* Botón Filtrar */}
                    <button
                        onClick={() => setShowFilterModal(true)}
                        className="btn btn-outline-dark d-flex align-items-center gap-2 fw-bold"
                        style={{ borderRadius: '50px', padding: '0.5rem 1.2rem', borderWidth: '2px' }}
                    >
                        <FunnelFill size={18} /> Filtrar
                    </button>

                    {/* Botón Descargar (Estilo unificado) */}
                    <button
                        onClick={handleDownloadCSV}
                        className="btn btn-outline-dark d-flex align-items-center gap-2 fw-bold"
                        style={{ borderRadius: '50px', padding: '0.5rem 1.2rem', borderWidth: '2px' }}
                        disabled={usuariosFiltrados.length === 0}
                    >
                        <Download size={18} /> Descargar
                    </button>

                    {/* Botón Crear Usuario */}
                    <button
                        onClick={() => setShowCreateUser(true)}
                        className="btn btn-outline-dark d-flex align-items-center gap-2 fw-bold"
                        style={{ borderRadius: '50px', padding: '0.5rem 1.2rem', borderWidth: '2px' }}
                    >
                        <PersonPlusFill size={20} /> Crear Usuario
                    </button>
                </div>
            </div>

            <hr style={{ borderTop: '4px solid black', opacity: 1, marginTop: '0', marginBottom: '2rem' }} />

            {/* (Hemos eliminado la barra de filtros antigua para usar el modal) */}

            {/* --- Tabla --- */}
            <div className="table-responsive bg-white border rounded shadow-sm">
                <Table hover className="mb-0 align-middle">
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
                                <td className="fw-bold">{u.nombre}</td>
                                <td>{u.correo}</td>
                                <td>
                                    <span className={`badge ${u.rol === 0 ? 'bg-danger' : u.rol === 1 ? 'bg-warning text-dark' : 'bg-primary'}`}>
                                        {u.rol === 0 ? 'Admin' : u.rol === 1 ? 'Profesor' : 'Alumno'}
                                    </span>
                                </td>
                                <td className="text-center">
                                    <Button
                                        variant="link"
                                        className="text-danger p-0"
                                        onClick={() => requestDeleteUser(u)}
                                        title="Eliminar usuario"
                                    >
                                        <Trash size={18} />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {usuariosFiltrados.length === 0 && (
                            <tr><td colSpan="5" className="text-center p-4 text-muted">No hay resultados que coincidan con los filtros.</td></tr>
                        )}
                    </tbody>
                </Table>
            </div>

            {/* ================= MODALES ================= */}

            {/* 1. Modal FILTRAR (Nuevo) */}
            <Modal show={showFilterModal} onHide={() => setShowFilterModal(false)} centered backdrop="static">
                <Modal.Header closeButton>
                    <Modal.Title className="fw-bold">Filtrar Usuarios</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <FloatingLabel controlId="floatingFilterRole" label="Filtrar por Rol" className="mb-3">
                            <Form.Select
                                value={filtroRol}
                                onChange={(e) => {
                                    setFiltroRol(e.target.value);
                                    if (e.target.value !== 'alumnos') setFiltroCurso('');
                                }}
                            >
                                <option value="todos">Todos los Roles</option>
                                <option value="alumnos">Alumnos</option>
                                <option value="profesores">Profesores</option>
                                <option value="admins">Administradores</option>
                            </Form.Select>
                        </FloatingLabel>

                        {filtroRol === 'alumnos' && (
                            <FloatingLabel controlId="floatingFilterCourse" label="Filtrar por Curso" className="animate-fade-in">
                                <Form.Select
                                    value={filtroCurso}
                                    onChange={(e) => setFiltroCurso(e.target.value)}
                                >
                                    <option value="">Todos los Cursos</option>
                                    {cursos.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </Form.Select>
                            </FloatingLabel>
                        )}
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={handleResetFilters}>
                        Limpiar Filtros
                    </Button>
                    <Button variant="primary" onClick={() => setShowFilterModal(false)}>
                        Aplicar
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* 2. Modal Crear Usuario */}
            <Modal show={showCreateUser} onHide={() => setShowCreateUser(false)} centered backdrop="static" size="lg">
                <Modal.Header closeButton>
                    <Modal.Title className="fw-bold">Crear Nuevo Usuario</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleCreateUser}>
                    <Modal.Body>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <FloatingLabel controlId="floatingRol" label="Rol del Usuario">
                                    <Form.Select
                                        value={newUser.rol}
                                        onChange={(e) => setNewUser({ ...newUser, rol: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="0">Administrador</option>
                                        <option value="1">Profesor</option>
                                        <option value="2">Alumno</option>
                                    </Form.Select>
                                </FloatingLabel>
                            </div>
                            <div className="col-md-6">
                                <FloatingLabel controlId="floatingRut" label="RUT">
                                    <Form.Control
                                        type="text"
                                        placeholder="12.345.678-9"
                                        value={newUser.rut}
                                        onChange={(e) => setNewUser({ ...newUser, rut: e.target.value })}
                                        required
                                    />
                                </FloatingLabel>
                            </div>
                            <div className="col-md-12">
                                <FloatingLabel controlId="floatingNombre" label="Nombre Completo">
                                    <Form.Control
                                        type="text"
                                        placeholder="Nombre"
                                        value={newUser.nombre}
                                        onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                                        required
                                    />
                                </FloatingLabel>
                            </div>
                            <div className="col-md-6">
                                <FloatingLabel controlId="floatingCorreo" label="Correo Electrónico">
                                    <Form.Control
                                        type="email"
                                        placeholder="nombre@ejemplo.com"
                                        value={newUser.correo}
                                        onChange={(e) => setNewUser({ ...newUser, correo: e.target.value })}
                                        required
                                    />
                                </FloatingLabel>
                            </div>
                            <div className="col-md-6">
                                <FloatingLabel controlId="floatingPass" label="Contraseña">
                                    <Form.Control
                                        type="password"
                                        placeholder="Contraseña"
                                        value={newUser.contrasena}
                                        onChange={(e) => setNewUser({ ...newUser, contrasena: e.target.value })}
                                        required
                                    />
                                </FloatingLabel>
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="outline-danger" onClick={() => setShowCreateUser(false)}>Cancelar</Button>
                        <Button variant="success" type="submit">Guardar Usuario</Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* 3. Confirmar Eliminación */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered backdrop="static">
                <Modal.Header closeButton className="bg-danger text-white">
                    <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                        <ExclamationTriangleFill /> Confirmar Eliminación
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="text-center py-4">
                    <p className="fs-5">
                        ¿Estás seguro de que quieres eliminar al usuario <br />
                        <strong>"{userToDelete?.nombre}"</strong>?
                    </p>
                    <p className="text-muted small">Esta acción no se puede deshacer.</p>
                </Modal.Body>
                <Modal.Footer className="justify-content-center">
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="px-4">Cancelar</Button>
                    <Button variant="danger" onClick={confirmDeleteUser} className="px-4">Sí, Eliminar</Button>
                </Modal.Footer>
            </Modal>

            {/* --- TOASTS --- */}
            <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 9999 }}>
                <Toast
                    onClose={() => setToastConfig({ ...toastConfig, show: false })}
                    show={toastConfig.show}
                    delay={4000}
                    autohide
                    bg={toastConfig.variant}
                >
                    <Toast.Header>
                        {toastConfig.variant === 'success' ? <CheckCircleFill className="text-success me-2" /> : <XCircleFill className="text-danger me-2" />}
                        <strong className="me-auto">Sistema</strong>
                        <small>Ahora</small>
                    </Toast.Header>
                    <Toast.Body className="text-white">
                        {toastConfig.message}
                    </Toast.Body>
                </Toast>
            </ToastContainer>
        </div>
    );
}