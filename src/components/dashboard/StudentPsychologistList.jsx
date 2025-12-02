import React, { useState, useEffect } from 'react';
import { Table, Button, Spinner, Badge, Card } from 'react-bootstrap';
import { PersonFill, BoxArrowInRight, JournalBookmarkFill } from 'react-bootstrap-icons';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';

export default function StudentPsychologistList({ onDragStart }) {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        try {
            const data = await apiFetch('/api/psicologos/mis-alumnos');
            setStudents(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center py-4"><Spinner animation="border" /></div>;
    if (error) return <div className="text-danger p-3">Error: {error}</div>;

    return (
        <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white border-bottom-0 pt-4 px-4">
                <h4 className="fw-bold text-primary m-0">
                    <PersonFill className="me-2" /> Mis Alumnos Asignados
                </h4>
            </Card.Header>
            <Card.Body className="p-0">
                <Table hover responsive className="m-0 align-middle">
                    <thead className="table-light">
                        <tr>
                            <th className="ps-4">Nombre</th>
                            <th>Correo</th>
                            <th>RUT</th>
                            <th className="text-end pe-4">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center py-5 text-muted">
                                    No tienes alumnos asignados actualmente.
                                </td>
                            </tr>
                        ) : (
                            students.map(student => (
                                <tr
                                    key={student.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/plain', JSON.stringify(student));
                                        e.dataTransfer.effectAllowed = 'copy';
                                        if (onDragStart) onDragStart(student); // Notify parent
                                    }}
                                    style={{ cursor: 'grab' }}
                                >
                                    <td className="ps-4 fw-bold">
                                        <PersonFill className="me-2 text-muted" />
                                        {student.nombre}
                                    </td>
                                    <td>{student.correo}</td>
                                    <td>{student.rut}</td>
                                    <td className="text-end pe-4">
                                        <Button
                                            variant="outline-primary"
                                            size="sm"
                                            className="me-2 rounded-pill"
                                            as={Link}
                                            to={`/dashboard/citas/crear?alumno=${student.id}&nombre=${encodeURIComponent(student.nombre)}`}
                                        >
                                            <JournalBookmarkFill className="me-1" /> Agendar Cita
                                        </Button>
                                        {/* Futuro: Ver Ficha */}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </Table>
            </Card.Body>
        </Card>
    );
}
