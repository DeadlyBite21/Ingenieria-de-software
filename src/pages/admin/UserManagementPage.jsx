// src/pages/admin/UserManagementPage.jsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

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
    FunnelFill,
    Download
} from 'react-bootstrap-icons';

export default function UserManagementPage() {
    const [usuarios, setUsuarios] = useState([]);
    const [cursos, setCursos] = useState([]);
    const [courseUsers, setCourseUsers] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // --- Estados de Modals ---
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);

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
                } catch (error) {
                    console.error(error);
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

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

            {/* 1. Crear Usuario */}
            <Modal show={showCreateUser} onHide={() => setShowCreateUser(false)} centered backdrop="static">
                <Modal.Header closeButton>
                    <Modal.Title className="fw-bold">Crear Nuevo Usuario</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleCreateUser}>
                    <Modal.Body>
                        <FloatingLabel controlId="floatingRut" label="RUT" className="mb-3">
                            <Form.Control
                                type="text" placeholder="12345678-9"
                                value={newUser.rut} onChange={(e) => setNewUser({ ...newUser, rut: e.target.value })}
                                required autoFocus
                            />
                        </FloatingLabel>
                        <FloatingLabel controlId="floatingNombre" label="Nombre Completo" className="mb-3">
                            <Form.Control
                                type="text" placeholder="Juan Pérez"
                                value={newUser.nombre} onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                                required
                            />
                        </FloatingLabel>
                        <FloatingLabel controlId="floatingEmail" label="Correo Electrónico" className="mb-3">
                            <Form.Control
                                type="email" placeholder="nombre@ejemplo.com"
                                value={newUser.correo} onChange={(e) => setNewUser({ ...newUser, correo: e.target.value })}
                                required
                            />
                        </FloatingLabel>
                        <FloatingLabel controlId="floatingPassword" label="Contraseña" className="mb-3">
                            <Form.Control
                                type="password" placeholder="Contraseña"
                                value={newUser.contrasena} onChange={(e) => setNewUser({ ...newUser, contrasena: e.target.value })}
                                required
                            />
                        </FloatingLabel>
                        <FloatingLabel controlId="floatingRol" label="Rol del Usuario">
                            <Form.Select
                                value={newUser.rol} onChange={(e) => setNewUser({ ...newUser, rol: e.target.value })}
                                required
                            >
                                <option value="">Selecciona un rol...</option>
                                <option value="0">Administrador</option>
                                <option value="1">Profesor</option>
                                <option value="2">Alumno</option>
                                <option value="3">Psicólogo</option>
                            </Form.Select>
                        </FloatingLabel>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="outline-secondary" onClick={() => setShowCreateUser(false)}>Cancelar</Button>
                        <Button variant="primary" type="submit">Guardar Usuario</Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* 2. Confirmar Eliminación */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
                <Modal.Header closeButton className="bg-danger text-white">
                    <Modal.Title><ExclamationTriangleFill className="me-2" /> Confirmar Eliminación</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    ¿Estás seguro que deseas eliminar al usuario <strong>{userToDelete?.nombre}</strong>?
                    <br />
                    Esta acción no se puede deshacer.
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
                    <Button variant="danger" onClick={confirmDeleteUser}>Eliminar</Button>
                </Modal.Footer>
            </Modal>

            {/* 3. Modal de Filtros (Nuevo) */}
            <Modal show={showFilterModal} onHide={() => setShowFilterModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title className="fw-bold">Filtrar Usuarios</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Por Rol</Form.Label>
                            <Form.Select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
                                <option value="todos">Todos los roles</option>
                                <option value="alumnos">Solo Alumnos</option>
                                <option value="profesores">Solo Profesores</option>
                                <option value="admins">Solo Administradores</option>
                            </Form.Select>
                        </Form.Group>

                        {/* Mostrar filtro de curso solo si el rol seleccionado es Alumnos */}
                        {filtroRol === 'alumnos' && (
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">Por Curso</Form.Label>
                                <Form.Select value={filtroCurso} onChange={(e) => setFiltroCurso(e.target.value)}>
                                    <option value="">Todos los cursos</option>
                                    {cursos.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        )}
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={handleResetFilters}>Limpiar Filtros</Button>
                    <Button variant="primary" onClick={() => setShowFilterModal(false)}>Aplicar</Button>
                </Modal.Footer>
            </Modal>

            {/* Toast de Notificaciones */}
            <ToastContainer position="bottom-end" className="p-3">
                <Toast onClose={() => setToastConfig({ ...toastConfig, show: false })} show={toastConfig.show} delay={3000} autohide bg={toastConfig.variant}>
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