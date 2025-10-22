// ===== PUBLIC (Landing + Turnero) =====
const $ = s => document.querySelector(s);
const svcSel = $('#svc'), dateInp = $('#date'), durInp = $('#duration'), timesWrap = $('#times');
const nameInp=$('#name'), phoneInp=$('#phone'), notesInp=$('#notes'), reserveBtn=$('#reserveBtn'), svcCards=$('#svcCards');

function uid(p='id'){ return p + Math.random().toString(36).slice(2,10); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtDate(d){ const [y,m,dd]=d.split('-'); return `${dd}/${m}/${y}`; }

/* === Estilos para turnos tomados (borde rosado) === */
(function injectUiStyles(){
  const css = `
    .btn.booked{
      border-color:#ec4899 !important;
      color:#ec4899 !important;
      box-shadow:0 0 0 .15rem rgba(236,72,153,.15);
      cursor:not-allowed;
      opacity:1 !important;
      background:#fff;
    }
    .btn.booked:hover{ border-color:#db2777 !important; color:#db2777 !important; }
    #times .btn.btn-primary{
      background:#ec4899 !important; border-color:#ec4899 !important; color:#fff !important;
      box-shadow:0 0 0 .2rem rgba(236,72,153,.25);
    }
    .is-loading { position:relative; pointer-events:none; opacity:.9; }
    .is-loading::after{
      content:"";
      position:absolute; inset:0;
      background:
        radial-gradient(18px 8px at 50% calc(50% - 6px), rgba(255,255,255,.85) 40%, transparent 41%) no-repeat,
        radial-gradient(18px 8px at 50% calc(50% + 6px), rgba(255,255,255,.85) 40%, transparent 41%) no-repeat;
      animation: pulseDots 1s infinite linear; border-radius:.5rem;
    }
    @keyframes pulseDots {
      0%{ background-position:49% 45%, 51% 55% } 50%{ background-position:51% 45%, 49% 55% } 100%{ background-position:49% 45%, 51% 55% }
    }
  `;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
})();

/* Toast (SweetAlert) */
const Toast = Swal.mixin({
  toast: true, position: 'top-end', showConfirmButton: false,
  timer: 2000, timerProgressBar: true,
  didOpen: (t)=>{ t.addEventListener('mouseenter', Swal.stopTimer); t.addEventListener('mouseleave', Swal.resumeTimer); }
});

(async function init(){
  const services = await DB.listServices();
  const settings = await DB.getSettings();

  // Combos + tarjetas servicio (mantengo IDs)
  svcSel.innerHTML = services.map(s=>`<option value="${s.id}" data-duration="${s.duration}" data-color="${s.color}" data-price="${s.price}">${s.name} — $${s.price}</option>`).join('');
  durInp.value = (services[0]?.duration || 30) + ' min';
  dateInp.value = todayISO();

  svcCards.innerHTML = services.map(s => `
    <div class="service-card">
      <div class="head">
        <div class="d-flex align-items-center"><span class="dot" style="background:${s.color}"></span><div class="title">${s.name}</div></div>
        <div class="price">AR$ ${s.price}</div>
      </div>
      <div class="meta">Duración aprox. ${s.duration} minutos</div>
      <div class="mt-auto">
        <button class="btn btn-accent w-100" onclick="document.getElementById('svc').value='${s.id}'; document.getElementById('svc').dispatchEvent(new Event('change')); window.scrollTo({top:0, behavior:'smooth'})">Elegir</button>
      </div>
    </div>
  `).join('');

  svcSel.addEventListener('change', ()=>{
    const opt=svcSel.selectedOptions[0];
    durInp.value = (opt?.dataset.duration || 30) + ' min';
    refreshTimes();
  });
  dateInp.addEventListener('change', refreshTimes);

  async function refreshTimes(){
    const date = dateInp.value;
    const bookings = await DB.listBookings();
    const cfg = await DB.getSettings();
    const slot = parseInt((cfg.slot || 30), 10);
    const open = (cfg.open || '09:00');
    const close = (cfg.close || '18:00');
    const slots = genSlots(open, close, slot);
    const occupied = new Set(bookings.filter(b => b.date===date && b.status!=='cancelado').map(b => b.time));

    timesWrap.innerHTML = slots.map(t=>{
      const isOcc = occupied.has(t);
      const cls = `btn btn-sm ${isOcc ? 'btn-outline booked' : 'btn-outline'}`;
      const disabled = isOcc ? 'disabled' : '';
      return `<button type="button" class="${cls}" ${disabled} data-time="${t}">${t}</button>`;
    }).join('');

    timesWrap.querySelectorAll('button').forEach(b => b.addEventListener('click', ()=>{
      if(b.hasAttribute('disabled')) return;
      timesWrap.querySelectorAll('button').forEach(x=>x.classList.remove('btn-primary'));
      b.classList.add('btn-primary');
    }));
  }

  function genSlots(open, close, step){
    const [oh,om]=open.split(':').map(Number); const [ch,cm]=close.split(':').map(Number);
    const start=oh*60+om, end=ch*60+cm; const out=[];
    for(let m=start; m<=end-step; m+=step){
      const hh=String(Math.floor(m/60)).padStart(2,'0'); const mm=String(m%60).padStart(2,'0');
      out.push(`${hh}:${mm}`);
    }
    return out;
  }

  refreshTimes();

  reserveBtn.addEventListener('click', async ()=>{
    try{
      reserveBtn.classList.add('is-loading'); reserveBtn.setAttribute('disabled','');

      const services = await DB.listServices();
      const settings = await DB.getSettings();
      const svc = services.find(s=>s.id===svcSel.value);
      const date = dateInp.value;
      const chosenBtn = timesWrap.querySelector('.btn-primary');
      const time = chosenBtn?.dataset.time;
      const name = nameInp.value.trim();
      const phone = (phoneInp.value||'').replace(/\D/g,'');
      const notes = notesInp.value.trim();

      if(!svc || !date || !time || !name || !phone){
        Toast.fire({icon:'warning', title:'Completá servicio, fecha, horario, nombre y WhatsApp.'});
        return;
      }

      const cancelToken = Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10);
      const booking = { id: uid('bk_'), date, time, serviceId: svc.id, name, phone, notes, status:'confirmado', createdAt: Date.now(), cancelToken, reminders:{h2:false} };
      await DB.addBooking(booking);

      if(chosenBtn){
        chosenBtn.classList.remove('btn-primary');
        chosenBtn.classList.add('booked');
        chosenBtn.setAttribute('disabled','');
        chosenBtn.textContent = time;
      }

      const cancelUrl = location.origin + location.pathname.replace('index.html','cancel.html') + `?id=${booking.id}&token=${cancelToken}`;
      const alias = settings.pay_alias || '';
      const aliasBlock = alias ? `<div class="mt-2">Podés abonar por <strong>alias</strong>: <code>${alias}</code> <button class="btn btn-outline btn-sm copy-btn" onclick="navigator.clipboard.writeText('${alias}')">Copiar</button></div>` : '';

      await Swal.fire({
        icon:'success',
        title:'¡Tu turno está reservado!',
        html: `
          <div class="text-start small">
            <div><strong>Servicio:</strong> ${svc.name}</div>
            <div><strong>Fecha:</strong> ${fmtDate(date)} ${time} hs</div>
            <div><strong>Cancelación:</strong> <a class="link" href="${cancelUrl}" target="_blank">clic aquí</a></div>
            ${aliasBlock}
          </div>
          <p class="small mt-2 text-muted mb-0">Te enviaremos recordatorio automático <strong>2 horas antes</strong>.</p>
        `,
        confirmButtonText:'Guardar y salir',
        confirmButtonColor:'#ec4899'
      });

      nameInp.value=''; phoneInp.value=''; notesInp.value='';
      timesWrap.querySelectorAll('button').forEach(x=>x.classList.remove('btn-primary'));
      await refreshTimes();
      Toast.fire({icon:'success', title:'Reserva guardada'});
    } catch(e){
      console.error(e);
      Swal.fire({icon:'error', title:'No se pudo reservar', text:'Intentá nuevamente.', confirmButtonColor:'#ec4899'});
    } finally {
      reserveBtn.classList.remove('is-loading'); reserveBtn.removeAttribute('disabled');
    }
  });
})();
