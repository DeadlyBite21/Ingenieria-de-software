import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';

export default function CreateAppointmentModal({
    show,
    onHide,
    onConfirm,
    loading,
    student,
    start,
    end
}) {
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');

    // Reset fields when modal opens
    useEffect(() => {
        if (show) {
            setTitle('Consulta Psicológica');
            setNotes('');
        }
    }, [show]);

    const handleConfirm = () => {
        onConfirm({
            title,
            notes,
            start,
            end,
            studentId: student?.id
        });
    };

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>Confirmar Nueva Cita</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="mb-3">
                    <strong>Alumno:</strong> {student?.nombre} <br />
                    <strong>Fecha:</strong> {start?.toLocaleDateString()} <br />
                    <strong>Hora:</strong> {start?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                <Form.Group className="mb-3">
                    <Form.Label>Título</Form.Label>
                    <Form.Control
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>Notas (Opcional)</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>Cancelar</Button>
                <Button
                    variant="primary"
                    onClick={handleConfirm}
                    disabled={loading}
                >
                    {loading ? <Spinner size="sm" animation="border" /> : 'Agendar Cita'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
