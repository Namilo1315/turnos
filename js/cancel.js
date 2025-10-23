// cancel.js — Cancelar turno por id + token (robusto)
(function () {
  const $ = s => document.querySelector(s);
  const status  = $('#status');
  const details = $('#details');
  const after   = $('#after');

  const params = new URLSearchParams(location.search);
  const id    = params.get('id');
  const token = params.get('token');

  function showAlert(type, html) {
    status.innerHTML = `<div class="alert alert-${type}" role="alert">${html}</div>`;
  }

  if (!id || !token) {
    showAlert('warning', 'Link inválido.');
    return;
  }

  (async () => {
    try {
      showAlert('info', 'Procesando cancelación…');

      const bookings = await DB.listBookings();
      const b = bookings.find(x => String(x.id) === String(id));

      if (!b) { showAlert('danger', 'No encontramos ese turno.'); return; }
      if (b.cancelToken !== token) { showAlert('danger', 'Token inválido.'); return; }

      if (b.status === 'cancelado') {
        showAlert('info', 'Este turno ya estaba cancelado.');
      } else {
        await DB.updateBooking(b.id, { status: 'cancelado' });
        showAlert('success', 'Listo, tu turno fue cancelado.');
      }

      details.innerHTML = `
        <div class="small text-muted">
          <strong>${b.name}</strong> — ${b.date} ${b.time}
        </div>
      `;
      after.classList.remove('d-none');
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Ocurrió un error al cancelar el turno. Probá nuevamente.');
    }
  })();
})();

