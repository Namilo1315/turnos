
(function(){
  const status = document.getElementById('status');
  const details = document.getElementById('details');
  const after = document.getElementById('after');
  const params = new URLSearchParams(location.search);
  const id = params.get('id'); const token = params.get('token');
  if(!id || !token){
    status.innerHTML = '<div class="alert alert-warning">Link inválido.</div>'; return;
  }
  DB.listBookings().then(async (bookings)=>{
    const b = bookings.find(x=>x.id===id);
    if(!b){ status.innerHTML='<div class="alert alert-danger">No encontramos ese turno.</div>'; return; }
    if(b.cancelToken!==token){ status.innerHTML='<div class="alert alert-danger">Token inválido.</div>'; return; }
    if(b.status==='cancelado'){ status.innerHTML='<div class="alert alert-info">Este turno ya estaba cancelado.</div>'; return; }
    await DB.updateBooking(b.id, {status:'cancelado'});
    status.innerHTML = '<div class="alert alert-success">Listo, tu turno fue cancelado.</div>';
    details.innerHTML = `<div class="small text-muted"> ${b.name} — ${b.date} ${b.time}</div>`;
    after.classList.remove('d-none');
  });
})();
