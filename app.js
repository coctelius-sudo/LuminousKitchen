(function(){
  const $ = (sel, root=document)=>root.querySelector(sel);
  const $$ = (sel, root=document)=>[...root.querySelectorAll(sel)];

  const KEY = 'cocina_inventario_v1';

  const db = {
    categorias: [],
    productos: []
  };

  // --- storage ---
  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        db.categorias = parsed.categorias||[];
        db.productos = parsed.productos||[];
      }
    }catch(e){}
    if(db.categorias.length===0){
      // seed
      db.categorias = [
        {id: uid(), nombre:'Carnes'},
        {id: uid(), nombre:'Vegetales'}
      ];
      save();
    }
  }
  function save(){
    localStorage.setItem(KEY, JSON.stringify(db));
  }
  function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

  // --- UI Navigation ---
  $$('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      $$('.view').forEach(v=>v.classList.remove('active'));
      $('#view-'+target).classList.add('active');
    });
  });

  // PWA install
  let deferred;
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferred = e;
    const b = $('#installBtn');
    b.hidden = false;
    b.onclick = async ()=>{
      b.disabled = true;
      deferred.prompt();
      await deferred.userChoice;
      b.hidden = true; deferred = null;
    };
  });

  // --- Categorias ---
  function renderCategorias(){
    const ul = $('#listaCategorias'); ul.innerHTML='';
    const tpl = $('#tplCategoria');
    $('#vacioCategorias').style.display = db.categorias.length? 'none':'block';
    db.categorias.forEach(cat=>{
      const li = tpl.content.firstElementChild.cloneNode(true);
      $('.card-title', li).textContent = cat.nombre;
      const count = db.productos.filter(p=>p.categoriaId===cat.id).length;
      $('.sub', li).textContent = `${count} producto${count===1?'':'s'}`;
      $('.renombrar', li).onclick = ()=>{
        const nuevo = prompt('Nuevo nombre de la categoría:', cat.nombre);
        if(!nuevo) return;
        cat.nombre = nuevo.trim();
        save(); renderCategorias(); renderFiltros(); renderProductos();
      };
      $('.borrar', li).onclick = ()=>{
        if(db.productos.some(p=>p.categoriaId===cat.id)){
          alert('No puedes borrar una categoría con productos. Mueve o borra sus productos primero.');
          return;
        }
        if(confirm('¿Borrar esta categoría?')){
          db.categorias = db.categorias.filter(c=>c.id!==cat.id);
          save(); renderCategorias(); renderFiltros();
        }
      };
      ul.appendChild(li);
    });

    // fill select
    const sel = $('#pCategoria'); sel.innerHTML='';
    db.categorias.forEach(c=>{
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.nombre;
      sel.appendChild(opt);
    });
  }

  $('#addCategoriaBtn').addEventListener('click', ()=>{
    const nombre = $('#nuevaCategoriaNombre').value.trim();
    if(!nombre) return;
    db.categorias.push({id: uid(), nombre});
    $('#nuevaCategoriaNombre').value='';
    save(); renderCategorias(); renderFiltros();
  });

  // --- Productos ---
  function renderFiltros(){
    const cont = $('#filtrosCategorias'); cont.innerHTML='';
    const chipAll = document.createElement('button');
    chipAll.className='chip active'; chipAll.textContent='Todas'; chipAll.dataset.id='*';
    cont.appendChild(chipAll);
    db.categorias.forEach(c=>{
      const b = document.createElement('button');
      b.className='chip'; b.textContent=c.nombre; b.dataset.id=c.id;
      cont.appendChild(b);
    });
    cont.querySelectorAll('.chip').forEach(ch=> ch.addEventListener('click', ()=>{
      cont.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
      ch.classList.add('active');
      renderProductos();
    }));
  }

  function renderProductos(){
    const q = $('#buscarProducto').value.trim().toLowerCase();
    const activeChip = $('#filtrosCategorias .chip.active');
    const catId = activeChip? activeChip.dataset.id : '*';
    let list = db.productos.slice();
    if(catId!=='*') list = list.filter(p=>p.categoriaId===catId);
    if(q) list = list.filter(p=> p.nombre.toLowerCase().includes(q) || (p.descripcion||'').toLowerCase().includes(q));
    // sort by category name then product
    list.sort((a,b)=>{
      const ca = getCatName(a.categoriaId).localeCompare(getCatName(b.categoriaId));
      if(ca!==0) return ca;
      return a.nombre.localeCompare(b.nombre);
    });

    const ul = $('#listaProductos'); ul.innerHTML='';
    const tpl = $('#tplProducto');
    $('#vacioProductos').style.display = list.length? 'none':'block';

    let sin=0, bajo=0;
    list.forEach(p=>{
      if(Number(p.stock)<=0) sin++;
      if(Number(p.stock)<Number(p.min)||Number(p.stock)===0) bajo++;

      const li = tpl.content.firstElementChild.cloneNode(true);
      $('.card-title', li).textContent = p.nombre;
      $('.badge', li).textContent = getCatName(p.categoriaId);
      $('.card-sub', li).textContent = `Stock: ${fmtNumber(p.stock)} ${p.unidad}  ·  Mín: ${fmtNumber(p.min)} ${p.unidad}`;
      $('.card-desc', li).textContent = p.descripcion||'';

      $('.editar', li).onclick = ()=> openProductoDialog(p);
      $('.borrar', li).onclick = ()=>{
        if(confirm('¿Borrar este producto?')){
          db.productos = db.productos.filter(x=>x.id!==p.id);
          save(); renderProductos(); renderCategorias();
        }
      };
      ul.appendChild(li);
    });

    // stats
    $('#stat-total').textContent = db.productos.length;
    $('#stat-sinstock').textContent = sin;
    $('#stat-bajo').textContent = bajo;
  }

  function getCatName(id){
    return (db.categorias.find(c=>c.id===id)||{}).nombre || 'Sin categoría';
  }

  function fmtNumber(n){
    const v = Number(n||0);
    return Number.isInteger(v)? String(v) : v.toLocaleString(undefined, {maximumFractionDigits:2});
  }

  $('#buscarProducto').addEventListener('input', renderProductos);
  $('#agregarProductoBtn').addEventListener('click', ()=> openProductoDialog(null));

  const dlg = $('#dlgProducto');
  function openProductoDialog(prod){
    $('#dlgTitulo').textContent = prod? 'Editar Item' : 'Agregar Item';
    $('#pNombre').value = prod? prod.nombre : '';
    $('#pCategoria').value = prod? prod.categoriaId : (db.categorias[0]?.id||'');
    $('#pStock').value = prod? prod.stock : 0;
    $('#pUnidad').value = prod? prod.unidad : '';
    $('#pMin').value = prod? prod.min : 1;
    $('#pDesc').value = prod? (prod.descripcion||'') : '';
    dlg.returnValue='';
    dlg.showModal();
    dlg.onclose = ()=>{
      if(dlg.returnValue!=='ok') return;
      // Save
      const nuevo = {
        nombre: $('#pNombre').value.trim(),
        categoriaId: $('#pCategoria').value,
        stock: parseFloat($('#pStock').value||'0'),
        unidad: $('#pUnidad').value.trim(),
        min: parseFloat($('#pMin').value||'0'),
        descripcion: $('#pDesc').value.trim()
      };
      if(!nuevo.nombre || !nuevo.categoriaId || !nuevo.unidad){ return; }
      if(prod){
        Object.assign(prod, nuevo);
      }else{
        db.productos.push({id: uid(), ...nuevo});
      }
      save(); renderProductos(); renderCategorias();
    };
  }

  // --- REPORTES ---
  const negocioNombreInput = null; // could add settings later
  function buildHeader(titulo){
    const negocio = 'Cocina';
    const fecha = new Date().toLocaleDateString();
    return `${titulo.toUpperCase()}\n${negocio}\nFecha: ${fecha}\n`;
  }

  function groupByCategoria(items){
    const map = {};
    items.forEach(p=>{
      const cat = getCatName(p.categoriaId);
      (map[cat] = map[cat]||[]).push(p);
    });
    // sort categories alphabetically
    const cats = Object.keys(map).sort((a,b)=>a.localeCompare(b));
    // sort items by name
    cats.forEach(c=> map[c].sort((a,b)=> a.nombre.localeCompare(b.nombre)));
    return {map, cats};
  }

  function reporteInventario(){
    const header = buildHeader('Reporte de Inventario');
    if(db.productos.length===0) return header + '\nNo hay productos.\n';
    const {map, cats} = groupByCategoria(db.productos);
    let out = header + '\nRESUMEN:\n• Productos totales: ' + db.productos.length + '\n\nDETALLE:\n';
    cats.forEach(cat=>{
      out += `\n${cat}\n`;
      map[cat].forEach(p=>{
        out += `${p.nombre}\n  Stock actual: ${fmtNumber(p.stock)} ${p.unidad}\n  Stock mínimo: ${fmtNumber(p.min)} ${p.unidad}\n`;
        if(p.descripcion) out += `  Nota: ${p.descripcion}\n`;
        out += '---\n';
      });
    });
    return out.trim();
  }

  function reporteCompras(){
    const header = buildHeader('Reporte de Compras Sugeridas');
    const need = db.productos.filter(p=> Number(p.stock)<Number(p.min));
    if(need.length===0) return header + '\nNo hay compras sugeridas.\n';
    const {map, cats} = groupByCategoria(need);
    let out = header + `\nRESUMEN:\n• Productos a comprar: ${need.length}\n\nCOMPRAS SUGERIDAS:\n`;
    cats.forEach(cat=>{
      map[cat].forEach(p=>{
        const falta = Math.max(0, Number(p.min) - Number(p.stock));
        out += `${p.nombre} (${cat})\n  Stock actual: ${fmtNumber(p.stock)} ${p.unidad}\n  Stock mínimo: ${fmtNumber(p.min)} ${p.unidad}\n  Cantidad sugerida: ${fmtNumber(falta)} ${p.unidad}\n---\n`;
      });
    });
    return out.trim();
  }
function reporteComprasSimple() {
  const header = buildHeader('Reporte de Compras Simple');
  const need = db.productos.filter(p => Number(p.stock) < Number(p.min));
  if (need.length === 0) return header + '\nNo hay compras sugeridas.\n';

  // Orden fijo de categorías
  const ordenCategorias = ["Carnes", "Vegetales", "Viveres"];

  // Agrupar por categoría
  const map = {};
  need.forEach(p => {
    const cat = getCatName(p.categoriaId);
    (map[cat] = map[cat] || []).push(p);
  });

  // Ordenar categorías según el orden fijo
  const cats = Object.keys(map).sort((a, b) => {
    let ia = ordenCategorias.indexOf(a);
    let ib = ordenCategorias.indexOf(b);
    if (ia === -1) ia = 99; // categorías extra al final
    if (ib === -1) ib = 99;
    return ia - ib;
  });

  let out = header + '\nCOMPRAS:\n';
  cats.forEach(cat => {
    // Ordenar productos por nombre
    map[cat].sort((a, b) => a.nombre.localeCompare(b.nombre));
    out += `\n${cat}\n`;
    map[cat].forEach(p => {
      const falta = Math.max(0, Number(p.min) - Number(p.stock));
      out += `${p.nombre}\nCompra: ${fmtNumber(falta)} ${p.unidad}\n\n`;
    });
  });

  return out.trim();
}
  
  function reporteAlertas(){
    const header = buildHeader('Alertas de Stock');
    const alertas = db.productos.filter(p=> Number(p.stock)<=0 || Number(p.stock)<Number(p.min));
    if(alertas.length===0) return header + '\nNo hay alertas.\n';
    const {map, cats} = groupByCategoria(alertas);
    let out = header + `\nRESUMEN:\n• Alertas: ${alertas.length}\n\nDETALLE:\n`;
    cats.forEach(cat=>{
      map[cat].forEach(p=>{
        const estado = Number(p.stock)<=0? 'SIN STOCK' : 'STOCK BAJO';
        out += `${p.nombre} (${cat}) — ${estado}\n  Stock actual: ${fmtNumber(p.stock)} ${p.unidad}\n  Stock mínimo: ${fmtNumber(p.min)} ${p.unidad}\n---\n`;
      });
    });
    return out.trim();
  }

  function showReporte(texto){
    $('#reporteTexto').value = texto;
    $('#reporteSalida').classList.remove('hidden');
    // set whatsapp link
    const enc = encodeURIComponent(texto);
    $('#waReporte').href = 'https://wa.me/?text=' + enc;
  }

  $('#genInventario').onclick = ()=> showReporte(reporteInventario());
  $('#genCompras').onclick = ()=> showReporte(reporteCompras());
  $('#genAlertas').onclick = ()=> showReporte(reporteAlertas());
  $('#genComprasSimple').onclick = () => showReporte(reporteComprasSimple());
  
  $('#copyReporte').onclick = async ()=>{
    try{
      await navigator.clipboard.writeText($('#reporteTexto').value);
      alert('Reporte copiado al portapapeles.');
    }catch(e){
      alert('No se pudo copiar. Selecciona el texto y copia manualmente.');
    }
  };
  $('#shareReporte').onclick = async ()=>{
    const text = $('#reporteTexto').value;
    if(navigator.share){
      try{ await navigator.share({ text }); }catch(e){}
    }else{
      alert('Tu navegador no soporta compartir nativo. Usa el botón de WhatsApp o Copiar.');
    }
  };

  // --- Backup / Import ---
  $('#exportarBtn').onclick = ()=>{
    const blob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cocina_inventario_export.json';
    a.click(); URL.revokeObjectURL(url);
  };
  $('#importarInput').addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    try{
      const txt = await file.text();
      const data = JSON.parse(txt);
      if(!data || !Array.isArray(data.categorias) || !Array.isArray(data.productos)) throw new Error('Formato inválido');
      db.categorias = data.categorias; db.productos = data.productos;
      save(); renderCategorias(); renderFiltros(); renderProductos();
      alert('Importación exitosa.');
    }catch(err){
      alert('No se pudo importar: ' + err.message);
    }finally{ e.target.value=''; }
  });
  $('#resetBtn').onclick = ()=>{
    if(confirm('Esto borrará todas tus categorías y productos.')){
      db.categorias=[]; db.productos=[]; save();
      renderCategorias(); renderFiltros(); renderProductos();
    }
  };

  // init
  load(); renderCategorias(); renderFiltros(); renderProductos();
})();
if (navigator.serviceWorker.controller) {
  navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
}
// Detectar nueva versión del Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    // Escuchar cambios en el SW
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // Hay nueva versión disponible
            const aviso = confirm("¡Nueva versión disponible! ¿Deseas recargar para actualizar?");
            if (aviso) window.location.reload();
          }
        }
      });
    });
  }).catch(err => console.log("SW registration failed:", err));
}

