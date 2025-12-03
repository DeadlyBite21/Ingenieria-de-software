import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'react-bootstrap-icons';
import {
  Form,
  Button,
  Card,
  Alert,
  Spinner,
  Badge,
} from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';

const HOY = new Date();
const INICIO_MES_HOY = new Date(HOY.getFullYear(), HOY.getMonth(), 1);

// mismos bloques que en backend
const SLOTS = [
  { id: '09:00-09:30', label: '09:00 - 09:30', inicio: '09:00', fin: '09:30' },
  { id: '09:45-10:15', label: '09:45 - 10:15', inicio: '09:45', fin: '10:15' },
  { id: '10:30-11:00', label: '10:30 - 11:00', inicio: '10:30', fin: '11:00' },
  { id: '11:15-11:45', label: '11:15 - 11:45', inicio: '11:15', fin: '11:45' },
  { id: '12:00-12:30', label: '12:00 - 12:30', inicio: '12:00', fin: '12:30' },
  { id: '14:00-14:30', label: '14:00 - 14:30', inicio: '14:00', fin: '14:30' },
  { id: '14:45-15:15', label: '14:45 - 15:15', inicio: '14:45', fin: '15:15' },
  { id: '15:30-16:00', label: '15:30 - 16:00', inicio: '15:30', fin: '16:00' },
  { id: '16:15-16:45', label: '16:15 - 16:45', inicio: '16:15', fin: '16:45' },
];

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return new Date(year, month + 1, 0).getDate();
}

function nombreMes(date) {
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
}

export default function CitasCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const esAdmin = user?.rol === 0;
  const esAlumno = user?.rol === 2;
  const esPsicologo = user?.rol === 3;

  const usaCalendario = esAlumno || esPsicologo; // psicólogo puede usar calendario para seleccionar alumno

  const [alumnos, setAlumnos] = useState([]);
  const [psicologos, setPsicologos] = useState([]);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // estado común
  const [motivo, setMotivo] = useState('');
  const [lugar, setLugar] = useState('');

  // estados específicos de alumno (flujo con calendario)
  const [psicologoSeleccionado, setPsicologoSeleccionado] = useState('');
  const [mesActual, setMesActual] = useState(() => startOfMonth(new Date()));
  const [diaSeleccionado, setDiaSeleccionado] = useState(null); // número de día
  const [slotsDia, setSlotsDia] = useState([]); // slots con disponible
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // estado para otros roles (form simple)
  const [formSimple, setFormSimple] = useState({
    idAlumno: '',
    idPsicologo: '',
    fecha: '',
    slot: '',
  });

  useEffect(() => {
  async function load() {
    try {
      const psicoData = await apiFetch('/api/psicologos');
      setPsicologos(psicoData);

      if (esAdmin) {
        const usuarios = await apiFetch('/api/usuarios');
        setAlumnos(usuarios.filter((u) => u.rol === 2));
      } else if (esAlumno) {
        setFormSimple((prev) => ({ ...prev, idAlumno: user.id }));
      } else if (esPsicologo) {
        // aquí el psicólogo usa calendario y necesita alumnos
        const alumnosData = await apiFetch('/api/alumnos');
        setAlumnos(alumnosData);
        setPsicologoSeleccionado(String(user.id)); // su propio id para el calendario
        setFormSimple((prev) => ({ ...prev, idPsicologo: user.id }));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  load();
}, [esAdmin, esAlumno, esPsicologo, user]);


  // ---------- LÓGICA ALUMNO: cargar disponibilidad del día ----------
  const fechaISOSeleccionada = () => {
    if (!diaSeleccionado) return null;
    const y = mesActual.getFullYear();
    const m = String(mesActual.getMonth() + 1).padStart(2, '0');
    const d = String(diaSeleccionado).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const cargarSlotsDia = async (dia) => {
    if (!psicologoSeleccionado) return;
    setDiaSeleccionado(dia);
    setSlotSeleccionado(null);
    setMotivo('');
    setLugar('');
    setLoadingSlots(true);
    setError('');

    const fecha = (() => {
      const y = mesActual.getFullYear();
      const m = String(mesActual.getMonth() + 1).padStart(2, '0');
      const d = String(dia).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })();

    try {
      const data = await apiFetch(
        `/api/citas/disponibilidad?psicologoId=${psicologoSeleccionado}&fecha=${fecha}`
      );
      setSlotsDia(data);
    } catch (err) {
      setError(err.message);
      setSlotsDia([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const cambiarMes = (delta) => {
    const nuevo = new Date(mesActual);
    nuevo.setMonth(nuevo.getMonth() + delta);
    const inicioNuevo = startOfMonth(nuevo);

    // no permitir meses anteriores al mes actual
    if (inicioNuevo < INICIO_MES_HOY) return;

    setMesActual(inicioNuevo);
    setDiaSeleccionado(null);
    setSlotsDia([]);
    setSlotSeleccionado(null);
  };

  // ---------- SUBMIT COMÚN (crea cita) ----------
  const crearCita = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      let fecha;
      let inicioHM;
      let finHM;
      let idAlumno;
      let idPsicologo;

      if (esAlumno || esPsicologo) {
        // flujo con calendario

        if (!diaSeleccionado || !slotSeleccionado) {
          setError('Debes seleccionar día y horario.');
          setSaving(false);
          return;
        }

        if (esAlumno && !psicologoSeleccionado) {
          setError('Debes seleccionar un psicólogo.');
          setSaving(false);
          return;
        }

        if (esPsicologo && !formSimple.idAlumno) {
          setError('Debes seleccionar un alumno.');
          setSaving(false);
          return;
        }

        const fechaStr = fechaISOSeleccionada();
        fecha = fechaStr;

        const slotInfo = SLOTS.find((s) => s.id === slotSeleccionado);
        if (!slotInfo) {
          setError('Bloque horario inválido.');
          setSaving(false);
          return;
        }

        inicioHM = slotInfo.inicio;
        finHM = slotInfo.fin;

        if (esAlumno) {
          idAlumno = user.id;
          idPsicologo = psicologoSeleccionado;
        } else {
          // psicólogo
          idAlumno = formSimple.idAlumno;
          idPsicologo = user.id;
        }
      } else {
        // Admin: formulario simple
        if (
          !formSimple.fecha ||
          !formSimple.slot ||
          !formSimple.idAlumno ||
          !formSimple.idPsicologo
        ) {
          setError('Debes completar alumno, psicólogo, fecha y bloque horario.');
          setSaving(false);
          return;
        }

        fecha = formSimple.fecha;
        const [ini, fin] = formSimple.slot.split('-');
        inicioHM = ini;
        finHM = fin;
        idAlumno = formSimple.idAlumno;
        idPsicologo = formSimple.idPsicologo;
      }

      const fechaHoraInicio = `${fecha}T${inicioHM}:00`;
      const fechaHoraFin = `${fecha}T${finHM}:00`;

      const lugarEnviar = esAlumno ? null : lugar;

      await apiFetch('/api/citas', {
        method: 'POST',
        body: JSON.stringify({
          psicologoId: idPsicologo,
          pacienteId: idAlumno,
          fechaHoraInicio,
          fechaHoraFin,
          motivo,
          lugar: lugarEnviar,
        }),
      });

      navigate('/dashboard/citas');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  // ---------- RENDER CALENDARIO (solo alumno) ----------
  const renderCalendarioAlumno = () => {
    const firstDay = startOfMonth(mesActual);
    const offset = (firstDay.getDay() + 6) % 7; // 0 = lunes
    const totalDays = daysInMonth(mesActual);
    const cells = [];

    // celdas vacías antes del día 1
    for (let i = 0; i < offset; i++) {
      cells.push(
        <div
          key={`empty-${i}`}
          className="border bg-light"
          style={{ height: 60 }}
        />
      );
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateDay = new Date(
        mesActual.getFullYear(),
        mesActual.getMonth(),
        day
      );

      const esHoy =
        dateDay.getFullYear() === HOY.getFullYear() &&
        dateDay.getMonth() === HOY.getMonth() &&
        dateDay.getDate() === HOY.getDate();

      // día sin hora (00:00) para comparar solo fecha
      const hoySinHora = new Date(
        HOY.getFullYear(),
        HOY.getMonth(),
        HOY.getDate()
      );
      const esPasado = dateDay < hoySinHora;

      const diaSemana = dateDay.getDay(); // 0 = domingo, 6 = sábado
      const esFinDeSemana = diaSemana === 0 || diaSemana === 6;

      const deshabilitado = esPasado || esFinDeSemana;
      const seleccionado = day === diaSeleccionado;

      cells.push(
        <button
          key={`day-${day}`}
          type="button"
          className={
            'border btn w-100 h-100 ' +
            (deshabilitado
              ? 'btn-secondary'
              : seleccionado
              ? 'btn-outline-primary'
              : 'btn-light')
          }
          style={{
            height: 60,
            fontWeight: esHoy ? 'bold' : 'normal',
            opacity: deshabilitado ? 0.6 : 1,
          }}
          disabled={deshabilitado}
          onClick={() => {
            if (!deshabilitado) cargarSlotsDia(day);
          }}
        >
          {day}
        </button>
      );
    }

    return (
      <>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Button
            variant="link"
            onClick={() => cambiarMes(-1)}
            disabled={
              startOfMonth(mesActual).getTime() ===
              INICIO_MES_HOY.getTime()
            }
          >
            &lt;
          </Button>
          <h5 className="mb-0">{nombreMes(mesActual)}</h5>
          <Button variant="link" onClick={() => cambiarMes(1)}>
            &gt;
          </Button>
        </div>

        <div
          className="d-none d-md-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px',
          }}
        >
          {['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d) => (
            <div key={d} className="text-center fw-bold py-1">
              {d}
            </div>
          ))}
          {cells}
        </div>
      </>
    );
  };


  // ---------- RENDER SLOTS DEL DÍA (alumno) ----------
  const renderSlotsDiaAlumno = () => {
    if (!diaSeleccionado) return null;

    const fechaStr = fechaISOSeleccionada();
    let fechaMostrar = '';

    if (fechaStr) {
      const [y, m, d] = fechaStr.split('-');
      fechaMostrar = `${d}/${m}/${y}`; // dd/mm/yyyy
    }


    return (
      <div className="mt-4">
        <h5 className="text-center mb-3">
          Citas disponibles en {fechaMostrar}
        </h5>

        {loadingSlots ? (
          <div className="text-center py-3">
            <Spinner animation="border" />
          </div>
        ) : slotsDia.length === 0 ? (
          <div className="text-center text-muted">
            No se pudo cargar la disponibilidad.
          </div>
        ) : (
          <div className="list-group">
            {slotsDia.map((slot) => {
              const disponible = slot.disponible;
              const seleccionado = slotSeleccionado === slot.id;

              return (
                <div
                  key={slot.id}
                  className="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div>
                    <div className={disponible ? 'text-success fw-bold' : 'text-muted fw-bold'}>
                      {slot.label}
                    </div>
                    <small className="text-muted">
                      Bloque {slot.inicio} - {slot.fin}
                    </small>
                  </div>
                  <div>
                    {disponible ? (
                      <Button
                        variant={seleccionado ? 'success' : 'outline-success'}
                        onClick={() => setSlotSeleccionado(slot.id)}
                      >
                        {seleccionado ? 'Seleccionado' : 'Reservar esta hora'}
                      </Button>
                    ) : (
                      <Button variant="secondary" disabled>
                        Ocupado
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ---------- RENDER PRINCIPAL ----------
  return (
    <div>
      <div className="mb-3">
        <Button as={Link} to="/dashboard/citas" variant="link">
          <ArrowLeft className="me-1" /> Volver a citas
        </Button>
      </div>

      <Card>
        <Card.Header>
          <h4 className="mb-0">Agendar nueva cita</h4>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={crearCita}>
            {/* Vista especial alumno */}
            {/* CABECERA ALUMNO */}
            {esAlumno && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Alumno</Form.Label>
                  <Form.Control value={user.nombre} disabled />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Psicólogo</Form.Label>
                  <Form.Select
                    value={psicologoSeleccionado}
                    onChange={(e) => {
                      setPsicologoSeleccionado(e.target.value);
                      setDiaSeleccionado(null);
                      setSlotsDia([]);
                      setSlotSeleccionado(null);
                    }}
                    required
                  >
                    <option value="">Seleccione un psicólogo...</option>
                    {psicologos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.correo})
                      </option>
                    ))}
                  </Form.Select>
                  {!psicologoSeleccionado && (
                    <small className="text-muted">
                      Primero selecciona un psicólogo para ver el calendario.
                    </small>
                  )}
                </Form.Group>
              </>
            )}

            {/* CABECERA PSICÓLOGO */}
            {esPsicologo && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Alumno</Form.Label>
                  <Form.Select
                    value={formSimple.idAlumno}
                    onChange={(e) =>
                      setFormSimple((prev) => ({
                        ...prev,
                        idAlumno: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Seleccione un alumno...</option>
                    {alumnos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} ({a.rut})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Psicólogo</Form.Label>
                  <Form.Control value={user.nombre} disabled />
                </Form.Group>
              </>
            )}

            {/* CALENDARIO + SLOTS (ALUMNO Y PSICÓLOGO) */}
            {usaCalendario && psicologoSeleccionado && (
              <>
                {renderCalendarioAlumno()}
                {renderSlotsDiaAlumno()}

                {slotSeleccionado && (
                  <div className="mt-4">
                    <Badge bg="info" className="mb-2">
                      Has seleccionado un bloque, completa el motivo para confirmar.
                    </Badge>

                    <Form.Group className="mb-3">
                      <Form.Label>Motivo</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        required
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                      />
                    </Form.Group>

                    {!esAlumno && (
                      <Form.Group className="mb-3">
                        <Form.Label>Lugar (opcional)</Form.Label>
                        <Form.Control
                          value={lugar}
                          onChange={(e) => setLugar(e.target.value)}
                        />
                      </Form.Group>
                    )}
                  </div>
                )}
              </>
            )}

            {/* FORMULARIO SIMPLE SOLO ADMIN (SIN CALENDARIO) */}
            {!usaCalendario && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Alumno</Form.Label>
                  <Form.Select
                    value={formSimple.idAlumno}
                    onChange={(e) =>
                      setFormSimple((prev) => ({
                        ...prev,
                        idAlumno: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Seleccione un alumno...</option>
                    {alumnos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} ({a.rut})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Psicólogo</Form.Label>
                  <Form.Select
                    value={formSimple.idPsicologo}
                    onChange={(e) =>
                      setFormSimple((prev) => ({
                        ...prev,
                        idPsicologo: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Seleccione un psicólogo...</option>
                    {psicologos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.correo})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <div className="row">
                  <div className="col-md-6">
                    <Form.Group className="mb-3">
                      <Form.Label>Fecha</Form.Label>
                      <Form.Control
                        type="date"
                        required
                        value={formSimple.fecha}
                        onChange={(e) =>
                          setFormSimple((prev) => ({
                            ...prev,
                            fecha: e.target.value,
                          }))
                        }
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-6">
                    <Form.Group className="mb-3">
                      <Form.Label>Bloque horario</Form.Label>
                      <Form.Select
                        required
                        value={formSimple.slot}
                        onChange={(e) =>
                          setFormSimple((prev) => ({
                            ...prev,
                            slot: e.target.value,
                          }))
                        }
                      >
                        <option value="">Seleccione un bloque...</option>
                        {SLOTS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </div>
                </div>

                <Form.Group className="mb-3">
                  <Form.Label>Motivo</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    required
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Lugar (opcional)</Form.Label>
                  <Form.Control
                    value={lugar}
                    onChange={(e) => setLugar(e.target.value)}
                  />
                </Form.Group>
              </>
            )}


            <div className="d-grid mt-3">
              <Button
                type="submit"
                disabled={saving || (usaCalendario && !slotSeleccionado)}
              >
                {saving ? <Spinner size="sm" animation="border" /> : 'Guardar cita'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
