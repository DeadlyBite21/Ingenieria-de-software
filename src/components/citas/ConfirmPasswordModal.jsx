import React from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';

export default function ConfirmPasswordModal({
    show,
    onHide,
    onConfirm,
    loading,
    psicologoName,
    date,
    time,
    motivo,
    setMotivo,
    password,
    setPassword
}) {
    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title className="fw-bold">Confirmar Reserva</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="mb-3">
                    <strong>Psicólogo:</strong> {psicologoName} <br />
                    <strong>Fecha:</strong> {date?.toLocaleDateString()} <br />
                    <strong>Hora:</strong> {time}
                </div>

                <Form.Group className="mb-3">
                    <Form.Label>Motivo de la consulta</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={2}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Breve descripción..."
                    />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label className="fw-bold text-danger">Ingresa tu contraseña para confirmar</Form.Label>
                    <Form.Control
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Tu contraseña actual"
                    />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>Cancelar</Button>
                <Button
                    variant="success"
                    onClick={onConfirm}
                    disabled={!password || loading}
                >
                    {loading ? <Spinner size="sm" animation="border" /> : 'Confirmar Cita'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
