import React from 'react';
import { Button, Spinner, Form } from 'react-bootstrap';
import { ClockFill } from 'react-bootstrap-icons';

export default function PsychologistAvailabilityGrid({
    slots,
    loading,
    selectedSlot,
    onSelectSlot,
    selectedDate
}) {
    return (
        <div className="mt-4">
            <Form.Label className="fw-bold">3. Horarios Disponibles ({selectedDate.toLocaleDateString()})</Form.Label>
            {loading ? (
                <div className="text-center py-3"><Spinner animation="border" size="sm" /> Buscando horas...</div>
            ) : slots.length === 0 ? (
                <div className="alert alert-warning">No hay horas disponibles para esta fecha.</div>
            ) : (
                <div className="d-flex flex-wrap gap-2">
                    {slots.map((slot, idx) => {
                        const horaInicio = new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return (
                            <Button
                                key={idx}
                                variant={selectedSlot === slot ? "primary" : "outline-primary"}
                                onClick={() => onSelectSlot(slot)}
                                className="d-flex align-items-center gap-2"
                            >
                                <ClockFill /> {horaInicio}
                            </Button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
