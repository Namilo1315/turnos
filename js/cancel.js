// cancel.js — Cancelar turno por id + token (robusto)
(function () {
  const $ = s => document.querySelector(s);
  const status  = $('#status');
  const details = $('#details');
  const after   = $('#after');
  const helper  = $('#helper');

  const params = new URLSearchParams(location.search);
  const id    = params.get('id');
  const token = params.get('token');

  function fmtDate(iso){
    try{
      const [y,m,d] = iso.split('-').map(Number);
      return new Date(y, m-1, d).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
    }catch{ return iso; }
  }
  function showAlert(type, html) {
    status.innerHTML = `<div class="alert alert-${type}" role="alert">${html}</div>`;
  }

  if (!id || !token) {
    showAlert('warning', 'Link inválido.');
    return;
  }

  // Venís desde el link con id+token, ocultamos el helper (si existe)
  if(helper) helper.classList.add('d-none');

  (async () => {
    try {
      showAlert('info', 'Procesando cancelación…');

      // Intentamos leer puntual por ID (si tu DB.js lo implementa), si no, buscamos en la lista
      let booking = null;
      if (typeof DB.getBooking === 'function') {
        booking = await DB.getBooking(id);
      } else {
        const all = await DB.listBookings();
        booking = all.find(x => String(x.id) === String(id));
      }

      if (!booking) { showAlert('danger', 'No encontramos ese turno.'); return; }
      if (booking.cancelToken !== token) { showAlert('danger', 'Token inválido.'); return; }

      if (booking.status === 'cancelado') {
        showAlert('info', 'Este turno ya estaba cancelado.');
      } else {
        await DB.updateBooking(booking.id, { status: 'cancelado' });
        showAlert('success', '¡Listo, tu turno fue cancelado!');
        booking.status = 'cancelado';
      }

      details.innerHTML = `
        <div class="small text-muted">
          <strong>${booking.name}</strong> — ${fmtDate(booking.date)} ${booking.time} hs
        </div>
      `;
      after.classList.remove('d-none');
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Ocurrió un error al cancelar el turno. Probá nuevamente.');
    }
  })();
})();
