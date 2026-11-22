import { useEffect, useState } from 'react';
import { gameStore } from '../hooks/useGame';
import { Ico } from '../components/Icon';

interface Step { icon: string; title: string; where?: string; body: string[] }
const STEPS: Step[] = [
  { icon: 'flag', title: 'Bienvenido al paddock', body: [
    'Empiezas en karting y quieres llegar a la F1: karting, F4, F3, F2 y, por fin, la F1. Gana, sube y deja tu nombre en la historia.',
    'El reloj lo mueves tú: +1 día, +7 días o siguiente evento. Se detiene solo en las carreras y cuando hay algo que decidir.',
  ] },
  { icon: 'home', title: 'Inicio', where: 'Mi carrera → Inicio', body: [
    'Tu panel: categoría, equipo, edad, nivel y puesto en el campeonato.',
    '«Qué hacer ahora» te chiva lo pendiente: entrenar, ofertas, lesiones, puntos por repartir.',
  ] },
  { icon: 'calendar', title: 'Calendario', where: 'Mi carrera → Calendario', body: [
    'Ocho Grandes Premios por temporada. Todas las categorías corren el mismo fin de semana.',
    'Sin equipo no corres (salvo en karting), y lesionado tampoco.',
  ] },
  { icon: 'dumbbell', title: 'Entrenamiento', where: 'Mi carrera → Entrenamiento', body: [
    'Elige plan: simulador, físico, reflejos, concentración, telemetría o mental. Cada uno sube una estadística… y cansa.',
    'Con la fatiga alta rindes peor y te lesionas más. Alterna trabajo y descanso.',
  ] },
  { icon: 'chart', title: 'Mi rendimiento', where: 'Mi carrera → Mi rendimiento', body: [
    'Doce estadísticas; tu nivel es la media. Suben entrenando y corriendo.',
    'Al cerrar la temporada ganas puntos de habilidad para repartir. Los jóvenes ganan más.',
  ] },
  { icon: 'heart', title: 'Vida personal', where: 'Mi carrera → Vida personal', body: [
    'Tu ánimo decide cuánto aprendes. Si te lo puedes permitir, ficha entrenador, fisio, apoyo mental o gestor de medios.',
    'De vez en cuando salta un evento personal con decisión incluida.',
  ] },
  { icon: 'wrench', title: 'Ajuste del coche', where: 'Mi carrera → Ajuste del monoplaza', body: [
    'Alerón, suspensión y frenos tienen un punto ideal en cada circuito. Acércate y ganas décimas.',
    'No lo ves a simple vista: en las libres pide tandas de ajuste y tu ingeniero te orienta. Con más experiencia, se equivoca menos.',
  ] },
  { icon: 'gauge', title: 'Fin de semana de GP', where: 'Salta solo el día de la carrera', body: [
    'Libres: cinco tandas para ritmo, gomas, ajuste o confianza. Cada salida tiene riesgo de accidente.',
    'Clasificación: elige goma y estilo de vuelta (segura, atacar o arriesgar). Carrera: goma, parada, ritmo y reacción a Safety Car, bandera roja y lluvia.',
    'Órdenes de equipo: solo saltan cuando hay algo en juego y tu compañero está cerca. Cede el que menos pesa en el equipo; si el prioritario eres tú, la orden la recibe él.',
  ] },
  { icon: 'mic', title: 'Prensa y relaciones', where: 'Fichajes → Relaciones', body: [
    'Tras las carreras te ponen el micrófono. Lo que digas mueve tu relación con equipo, prensa y rivales. Obedecer o ignorar órdenes, también.',
    'Jerarquía: el equipo apuesta por quien rinde más (puntos, victorias y nivel) y esa carta cambia con los resultados. El prioritario recibe antes las mejoras. La ves en Relaciones.',
  ] },
  { icon: 'file', title: 'Contratos', where: 'Fichajes → Equipos y contratos', body: [
    'Si rindes, llegan ofertas: acepta, rechaza o contraoferta (pide demasiado y se retiran).',
    'También puedes llamar tú a equipos y academias. Verás tu probabilidad; si te rechazan, 90 días de castigo.',
    'Sin resultados o con el contrato agotado puedes quedarte en la calle.',
  ] },
  { icon: 'chart', title: 'Cómo subir de categoría', where: 'Mi carrera → Mi rendimiento y Fichajes → Equipos y contratos', body: [
    'Nivel mínimo (la media de tus estadísticas): F4 45, F3 55, F2 65 y F1 75. Saltarte una categoría exige 8 puntos más que ese mínimo.',
    'Edad mínima: F4 15 años, F3 16, F2 17 y F1 18. Y hay una edad tope por categoría (karting 15, F4 18, F3 20, F2 22): si te pasas, los equipos pierden interés.',
    'Para la F1 también necesitas 40 puntos de superlicencia en las últimas 3 temporadas. Se ganan según tu puesto final: en F2 el campeón y el subcampeón suman 40, en F3 el campeón 30 y en F4 12. Si tu nivel es de 85 o más, o eres piloto de pruebas con 72 o más, puedes saltarte ese requisito.',
    'Con el nivel y la edad en regla llegan ofertas, o puedes pedir plaza tú en Equipos y contratos (ahí ves tu probabilidad). Terminar arriba en el campeonato, subir tu reputación y entrenar ayudan.',
  ] },
  { icon: 'grad', title: 'Academia, superlicencia y reserva', where: 'Fichajes → Equipos y contratos', body: [
    'Una academia te respalda y te abre puertas, pero exige resultados.',
    'Para la F1 necesitas 40 puntos de superlicencia, que salen de buenos puestos finales en las categorías de abajo.',
    'Desde F3 puedes ser piloto de pruebas: el equipo te llama a las libres de un GP, conduces su F1, cumples objetivos y te ganas un sitio.',
  ] },
  { icon: 'banknote', title: 'Dinero', where: 'Fichajes → Patrocinadores', body: [
    'Los patrocinadores traen dinero; tú eliges a quién pedírselo. No hay límite, pero las marcas rivales (dos petroleras, dos bancos…) no aceptan compartir contigo.',
    'Un agente consigue más ofertas, pero se lleva su parte.',
  ] },
  { icon: 'globe', title: 'El mundo se mueve', where: 'Mundo → Noticias, Clasificaciones, Rivales', body: [
    'Los rivales envejecen, mejoran, ascienden y se retiran. En la F1 se van los veteranos y entran jóvenes.',
    'En Noticias filtra por F1, F2, F3, F4 o karting; lo gordo sale en todas.',
    'Cada pocos años la FIA cambia el reglamento. Un cambio grande puede hundir a un dominador. Se anuncia un año antes.',
  ] },
  { icon: 'trophy', title: 'Legado', where: 'Legado', body: [
    'Logros, vitrina de trofeos, récords históricos por batir y la vitrina de campeones del mundo.',
    'Ganar o ser campeón se celebra, y cada fin de año recibes tu resumen con gráficas.',
  ] },
  { icon: 'landmark', title: 'Salón de la Fama', where: 'Legado → Salón de la Fama', body: [
    'Cuando quieras, cuelga el casco: entras en el Salón de la Fama con un veredicto según tu carrera, y el campeonato sigue sin ti.',
    'Guarda partida cuando te dé la gana. Este tutorial se repite desde Legado.',
  ] },
];

export default function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const st = STEPS[i], last = i === STEPS.length - 1;
  const close = () => { gameStore.dispatch({ type: 'TUTORIAL_DONE' }); onClose(); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') setI((v) => Math.min(STEPS.length - 1, v + 1)); else if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1)); else if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  return (
    <div className="modal tutorial" role="dialog" aria-modal="true" aria-label="Tutorial">
      <div className="modal-box info big">
        <div className="tut-head"><span className="tut-icon"><Ico name={st.icon} size={40} /></span><div><small className="muted">Paso {i + 1} de {STEPS.length}{st.where ? ` · ${st.where}` : ''}</small><h2>{st.title}</h2></div></div>
        {st.body.map((p, k) => <p key={k}>{p}</p>)}
        <div className="dots" aria-hidden="true">{STEPS.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />)}</div>
        <div className="row">
          <button className="btn" onClick={close}>Saltar tutorial</button><span className="spacer" />
          <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</button>
          <button className="btn primary" autoFocus onClick={() => (last ? close() : setI(i + 1))}>{last ? 'Empezar a jugar' : 'Siguiente'}</button>
        </div>
      </div>
    </div>
  );
}
