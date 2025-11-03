// src/pages/IncidentsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

// --- Importaciones de React Bootstrap ---
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import Badge from 'react-bootstrap/Badge';
import { EyeFill, PencilSquare, PlusCircleFill } from 'react-bootstrap-icons';

export default function IncidentsPage() {
  const { user, isAdmin, isProfesor } = useAuth();
  const [incidentes, setIncidentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estado para filtros
  const [filters, setFilters] = useState({ estado: '', idCurso: '' });
  
  // Estado para paginación
  const [pagination, setPagination] = useState({ 
    page: 1, 
    limit: 10, 
    total: 0 
  });

  // --- 1. Función para cargar los incidentes ---
  const loadIncidentes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Construir los query params
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
      });

      if (filters.estado) params.append('estado', filters.estado);
      if (filters.idCurso) params.append('idCurso', filters.idCurso);

      // La API (backend/api.js) devuelve { data, total, page, limit }
      const response = await apiFetch(`/api/incidentes?${params.toString()}`);
      
      setIncidentes(response.data);
      setPagination(prev => ({
        ...prev,
        total: response.total,
        page: response.page,
      }));

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]); // Dependencias para recargar

  // --- 2. useEffect para cargar datos al montar o al cambiar página ---
  useEffect(() => {
    loadIncidentes();
  }, [loadIncidentes]); // Usamos la función memoizada

  // --- 3. Handlers para filtros y paginación ---
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Al filtrar, volvemos a la página 1 y recargamos
  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    // loadIncidentes() se disparará por el cambio en 'page' si es necesario, 
    // pero lo llamamos explícitamente para asegurar la recarga con filtros.
    loadIncidentes(); 
  };

  const handleClearFilters = () => {
    setFilters({ estado: '', idCurso: '' });
    setPagination(prev => ({ ...prev, page: 1 }));
    // Dejamos que el submit manual haga la recarga
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // --- 4. Helpers de UI ---

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'abierto': return 'danger';
      case 'en-progreso': return 'warning';
      case 'cerrado': return 'success';
      default: return 'secondary';
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  // --- 5. Renderizado del componente ---
  return (
    <div>
      {/* Encabezado y botón de crear */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Gestión de Incidentes</h1>
        {/* Solo Admin o Profesor pueden crear */}
        {(isAdmin || isProfesor) && (
          <Button as={Link} to="/dashboard/incidentes/crear" variant="primary">
            <PlusCircleFill className="me-2" />
            Reportar Incidente
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <Card.Body>
          <Form onSubmit={handleFilterSubmit}>
            <div className="row g-3">
              <div className="col-md-4">
                <Form.Group controlId="filterCurso">
                  <Form.Label>ID de Curso</Form.Label>
                  <Form.Control 
                    type="text" 
                    name="idCurso"
                    value={filters.idCurso}
                    onChange={handleFilterChange}
                    placeholder="Ej: 1"
                    disabled={loading}
                  />
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group controlId="filterEstado">
                  <Form.Label>Estado</Form.Label>
                  <Form.Select 
                    name="estado"
                    value={filters.estado}
                    onChange={handleFilterChange}
                    disabled={loading}
                  >
                    <option value="">Todos</option>
                    <option value="abierto">Abierto</option>
                    <option value="en-progreso">En Progreso</option>
                    <option value="cerrado">Cerrado</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-4 d-flex align-items-end gap-2">
                <Button type="submit" variant="primary" disabled={loading}>Filtrar</Button>
                <Button type="button" variant="secondary" onClick={handleClearFilters} disabled={loading}>Limpiar</Button>
              </div>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* Feedback (Loading/Error) */}
      {loading && (
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
        </div>
      )}
      {error && <Alert variant="danger">Error al cargar incidentes: {error}</Alert>}

      {/* Tabla de Incidentes */}
      {!loading && !error && (
        <>
          <Card>
            <Table striped bordered hover responsive className="m-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Curso ID</th>
                  <th>Tipo</th>
                  <th>Severidad</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {incidentes.length > 0 ? (
                  incidentes.map(incidente => (
                    <tr key={incidente.id}>
                      <td>{incidente.id}</td>
                      <td>{incidente.id_curso}</td>
                      <td>{incidente.tipo}</td>
                      <td>{incidente.severidad}</td>
                      <td>
                        <Badge bg={getStatusBadge(incidente.estado)}>
                          {incidente.estado}
                        </Badge>
                      </td>
                      <td>{new Date(incidente.fecha).toLocaleString()}</td>
                      <td>
                        <Button as={Link} to={`/dashboard/incidentes/${incidente.id}`} variant="info" size="sm" className="me-2" title="Ver Detalle">
                          <EyeFill />
                        </Button>
                        {(isAdmin || isProfesor) && (
                          <Button as={Link} to={`/dashboard/incidentes/editar/${incidente.id}`} variant="warning" size="sm" title="Editar">
                            <PencilSquare />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center">No se encontraron incidentes con los filtros actuales.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
          
          {/* Paginación simple */}
          {pagination.total > 0 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted">
                Mostrando {incidentes.length} de {pagination.total} incidentes
              </span>
              <div className="d-flex gap-2">
                <Button 
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  variant="outline-secondary"
                >
                  ← Anterior
                </Button>
                <span className="align-self-center px-2">
                  Página {pagination.page} de {totalPages}
                </span>
                <Button 
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= totalPages}
                  variant="outline-secondary"
                >
                  Siguiente →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}